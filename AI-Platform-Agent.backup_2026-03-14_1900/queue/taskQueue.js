// ============================================================
//  queue/taskQueue.js — Priority Task Queue
//  Persistent (JSON-backed), priority-ordered, retry-aware
// ============================================================
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uuid, now, sleep } from '../shared/utils.js';
import { bus, Events }      from '../shared/events.js';
import { log }              from '../shared/logger.js';
import { Config }           from '../config/index.js';

const __dir    = path.dirname(fileURLToPath(import.meta.url));
const Q_FILE   = path.resolve(__dir, '../data/taskQueue.json');

// In-memory queue (also flushed to disk)
let _queue     = [];       // Array of TaskItem
let _running   = new Map();// taskId → Promise
let _started   = false;

/**
 * TaskItem shape:
 * { id, type, payload, priority, status, retries, maxRetries,
 *   createdAt, startedAt, finishedAt, result, error, tags }
 *
 * priority: 0 = highest, 10 = lowest
 */

// ─── Public API ───────────────────────────────────────────

/** Enqueue a task. Returns task id. */
export function enqueue(type, payload, options = {}) {
  const task = {
    id:         uuid(),
    type,
    payload,
    priority:   options.priority  ?? 5,
    status:     'pending',
    retries:    0,
    maxRetries: options.maxRetries ?? Config.queue.maxRetries,
    createdAt:  now(),
    startedAt:  null,
    finishedAt: null,
    result:     null,
    error:      null,
    tags:       options.tags || [],
  };
  _queue.push(task);
  _sortQueue();
  _persist();
  bus.emit(Events.TASK_QUEUED, { id: task.id, type });
  log.queue(`Enqueued [${type}] id=${task.id.slice(0, 8)} priority=${task.priority}`);
  return task.id;
}

/** Get task by id. */
export function getTask(id) {
  return _queue.find(t => t.id === id) || null;
}

/** Cancel a pending task. */
export function cancelTask(id) {
  const task = _queue.find(t => t.id === id && t.status === 'pending');
  if (!task) return false;
  task.status = 'cancelled';
  task.finishedAt = now();
  _persist();
  bus.emit(Events.TASK_CANCELLED, { id });
  return true;
}

/** Get queue stats. */
export function getQueueStats() {
  return {
    total:    _queue.length,
    pending:  _queue.filter(t => t.status === 'pending').length,
    running:  _queue.filter(t => t.status === 'running').length,
    done:     _queue.filter(t => t.status === 'done').length,
    failed:   _queue.filter(t => t.status === 'failed').length,
    cancelled:_queue.filter(t => t.status === 'cancelled').length,
    activeNow: _running.size,
  };
}

/** List tasks with optional filter. */
export function listTasks(filter = {}) {
  let tasks = [..._queue];
  if (filter.status)  tasks = tasks.filter(t => t.status === filter.status);
  if (filter.type)    tasks = tasks.filter(t => t.type === filter.type);
  if (filter.tag)     tasks = tasks.filter(t => t.tags?.includes(filter.tag));
  return tasks.slice(0, filter.limit || 50);
}

// ─── Worker Loop ──────────────────────────────────────────

/** Start processing the queue. */
export function startWorker(handlerMap = {}) {
  if (_started) return;
  _started = true;
  _loadFromDisk();
  log.queue('Worker started');
  _processLoop(handlerMap);
}

async function _processLoop(handlerMap) {
  while (_started) {
    const concurrency = Config.queue.concurrency;
    if (_running.size < concurrency) {
      const pending = _queue.filter(t => t.status === 'pending');
      const slots   = concurrency - _running.size;
      const batch   = pending.slice(0, slots);
      for (const task of batch) _runTask(task, handlerMap);
    }
    await sleep(Config.queue.pollInterval || 500);
  }
}

async function _runTask(task, handlerMap) {
  task.status    = 'running';
  task.startedAt = now();
  _persist();
  bus.emit(Events.TASK_STARTED, { id: task.id, type: task.type });

  const promise = (async () => {
    try {
      const handler = handlerMap[task.type];
      if (!handler) throw new Error(`No handler for task type: "${task.type}"`);

      const result    = await handler(task.payload, task);
      task.status     = 'done';
      task.result     = result;
      task.finishedAt = now();
      bus.emit(Events.TASK_COMPLETED, { id: task.id, type: task.type, result });
      log.queue(`Task done [${task.type}] id=${task.id.slice(0, 8)}`);

    } catch (err) {
      task.retries++;
      if (task.retries <= task.maxRetries) {
        task.status = 'pending'; // re-queue
        log.warn(`Task retry ${task.retries}/${task.maxRetries} [${task.type}]: ${err.message}`);
      } else {
        task.status     = 'failed';
        task.error      = err.message;
        task.finishedAt = now();
        bus.emit(Events.TASK_FAILED, { id: task.id, type: task.type, error: err.message });
        log.error(`Task failed [${task.type}] id=${task.id.slice(0, 8)}: ${err.message}`);
      }
    } finally {
      _running.delete(task.id);
      _persist();
    }
  })();

  _running.set(task.id, promise);
}

// ─── Persistence ──────────────────────────────────────────

function _persist() {
  try {
    const dir = path.dirname(Q_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Only persist non-running tasks (running will re-run on restart)
    const toSave = _queue.filter(t => t.status !== 'running').slice(-500);
    fs.writeFileSync(Q_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch {}
}

function _loadFromDisk() {
  try {
    if (!fs.existsSync(Q_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(Q_FILE, 'utf-8'));
    // Restore pending tasks; skip done/failed/cancelled older than 24h
    const cutoff = Date.now() - 86_400_000;
    _queue = saved.filter(t => {
      if (t.status === 'pending') return true;
      if (t.status === 'running') { t.status = 'pending'; return true; } // re-queue interrupted
      return new Date(t.finishedAt || t.createdAt).getTime() > cutoff;
    });
    _sortQueue();
    log.queue(`Loaded ${_queue.length} tasks from disk`);
  } catch { log.warn('Queue load failed, starting fresh'); }
}

function _sortQueue() {
  _queue.sort((a, b) => {
    if (a.status !== b.status) {
      const order = { pending: 0, running: 1, done: 2, failed: 3, cancelled: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }
    return (a.priority ?? 5) - (b.priority ?? 5);
  });
}

/** Stop worker. */
export function stopWorker() {
  _started = false;
  log.queue('Worker stopped');
}