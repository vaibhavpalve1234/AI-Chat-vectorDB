// ============================================================
//  kernel/agentScheduler.js — Agent Scheduler
//  Spawns agents, tracks lifecycle, enforces concurrency limits
// ============================================================
import pLimit      from 'p-limit';
import pRetry      from 'p-retry';
import { log }     from '../shared/logger.js';
import { bus, Events } from '../shared/events.js';
import { uuid, withTimeout, now } from '../shared/utils.js';
import { Config }  from '../config/index.js';

const REGISTRY = new Map();   // agentId → AgentRecord
const ACTIVE   = new Map();   // agentId → Promise
const limit    = pLimit(Config.queue.concurrency);

/**
 * AgentRecord shape:
 * { id, type, status, createdAt, startedAt, finishedAt, result, error, meta }
 */

/** Spawn an agent by type with input data. */
export async function spawnAgent(type, input, options = {}) {
  const id = uuid();
  const record = {
    id,
    type,
    status:     'queued',
    createdAt:  now(),
    startedAt:  null,
    finishedAt: null,
    result:     null,
    error:      null,
    meta:       options.meta || {},
  };

  REGISTRY.set(id, record);
  bus.emit(Events.AGENT_SPAWNED, { id, type, input });
  log.kernel(`Spawned agent [${type}] id=${id}`);

  const task = limit(async () => {
    record.status    = 'running';
    record.startedAt = now();
    bus.emit(Events.TASK_STARTED, { id, type });

    try {
      const handler = await resolveHandler(type);
      const timeout = options.timeoutMs || Config.queue.timeoutMs;
      const retries = options.retries   ?? Config.queue.maxRetries;

      const result = await pRetry(
        () => withTimeout(handler(input, { agentId: id, ...options }), timeout, type),
        {
          retries,
          onFailedAttempt: (err) =>
            log.warn(`Agent [${type}] attempt ${err.attemptNumber} failed: ${err.message}`),
        }
      );

      record.status     = 'done';
      record.result     = result;
      record.finishedAt = now();
      bus.emit(Events.AGENT_DONE, { id, type, result });
      bus.emit(Events.TASK_COMPLETED, { id, type, result });
      log.kernel(`Agent [${type}] id=${id} completed`);
      return result;

    } catch (err) {
      record.status     = 'failed';
      record.error      = err.message;
      record.finishedAt = now();
      bus.emit(Events.AGENT_ERROR,  { id, type, error: err.message });
      bus.emit(Events.TASK_FAILED,  { id, type, error: err.message });
      log.error(`Agent [${type}] id=${id} failed: ${err.message}`);
      throw err;
    } finally {
      ACTIVE.delete(id);
    }
  });

  ACTIVE.set(id, task);
  return { id, promise: task };
}

/** Run multiple agents in parallel, returns all results. */
export async function spawnParallel(specs) {
  const handles = await Promise.all(
    specs.map(({ type, input, options }) => spawnAgent(type, input, options))
  );
  const results = await Promise.allSettled(handles.map(h => h.promise));
  return handles.map((h, i) => ({
    agentId: h.id,
    type:    specs[i].type,
    status:  results[i].status,
    result:  results[i].status === 'fulfilled' ? results[i].value : null,
    error:   results[i].status === 'rejected'  ? results[i].reason?.message : null,
  }));
}

/** Get status of a specific agent. */
export function getAgentStatus(id) {
  return REGISTRY.get(id) || null;
}

/** Get all agent records, optionally filtered by status. */
export function listAgents(filter = null) {
  const all = Array.from(REGISTRY.values());
  return filter ? all.filter(r => r.status === filter) : all;
}

/** Cancel a queued/running agent (best-effort). */
export function cancelAgent(id) {
  const record = REGISTRY.get(id);
  if (!record) return false;
  if (record.status === 'running' || record.status === 'queued') {
    record.status     = 'cancelled';
    record.finishedAt = now();
    bus.emit(Events.TASK_CANCELLED, { id });
    log.kernel(`Agent ${id} cancelled`);
    return true;
  }
  return false;
}

/** Get scheduler stats. */
export function getSchedulerStats() {
  const all = Array.from(REGISTRY.values());
  return {
    total:     all.length,
    queued:    all.filter(r => r.status === 'queued').length,
    running:   all.filter(r => r.status === 'running').length,
    done:      all.filter(r => r.status === 'done').length,
    failed:    all.filter(r => r.status === 'failed').length,
    cancelled: all.filter(r => r.status === 'cancelled').length,
    activeNow: ACTIVE.size,
    concurrencyLimit: Config.queue.concurrency,
  };
}

// ─── Dynamic handler resolution ───────────────────────────
async function resolveHandler(type) {
  const map = {
    research:   () => import('../agents/researchAgent.js').then(m => m.run),
    coding:     () => import('../agents/codingAgent.js').then(m => m.run),
    evaluation: () => import('../agents/evaluationAgent.js').then(m => m.run),
    tool:       () => import('../agents/toolAgent.js').then(m => m.run),
  };
  const loader = map[type];
  if (!loader) throw new Error(`Unknown agent type: "${type}"`);
  return loader();
}