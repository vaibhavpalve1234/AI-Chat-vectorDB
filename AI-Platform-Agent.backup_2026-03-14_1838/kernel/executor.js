// ============================================================
//  kernel/executor.js — Plan Executor
//  Runs plan steps in dependency order, passes results forward
// ============================================================
import { spawnAgent, spawnParallel } from './agentScheduler.js';
import { replan }                    from './planner.js';
import { log }                       from '../shared/logger.js';
import { bus, Events }               from '../shared/events.js';
import { uuid, now, elapsed }        from '../shared/utils.js';

/**
 * Execute a plan produced by planner.js
 *
 * @param {Plan} plan
 * @param {object} options
 * @returns {Promise<ExecutionResult>}
 */
export async function executePlan(plan, options = {}) {
  const execId   = uuid();
  const start    = Date.now();
  const ctx      = {};          // shared context passed between steps
  const stepLogs = [];

  log.kernel(`Executing plan "${plan.goal.slice(0, 60)}" — ${plan.steps.length} steps`);

  const sortedSteps = topologicalSort(plan.steps);
  let finalResult   = null;

  for (const step of sortedSteps) {
    // Skip if already cancelled
    if (step.status === 'cancelled') continue;

    // Build input with context from previous steps
    const enrichedInput = enrichInput(step.input, ctx);

    log.kernel(`Step ${step.order}/${sortedSteps.length}: [${step.type}] ${step.description}`);
    step.status    = 'running';
    step.startedAt = now();

    try {
      const { promise } = await spawnAgent(step.type, enrichedInput, {
        tools:   step.tools,
        meta:    { planId: plan.id, stepId: step.id, stepOrder: step.order },
        ...options,
      });

      const result = await promise;

      step.status     = 'done';
      step.finishedAt = now();
      step.result     = result;

      // Store in shared context so later steps can reference it
      ctx[`step_${step.order}`] = result;
      ctx[`step_${step.id}`]    = result;
      ctx.lastResult            = result;

      stepLogs.push({ stepId: step.id, order: step.order, type: step.type, status: 'done' });
      finalResult = result;

    } catch (err) {
      step.status     = 'failed';
      step.finishedAt = now();
      step.error      = err.message;
      stepLogs.push({ stepId: step.id, order: step.order, type: step.type, status: 'failed', error: err.message });

      log.error(`Step ${step.order} failed: ${err.message}`);

      // Attempt replan if enabled
      if (options.replanOnFailure !== false && plan.steps.filter(s => s.status === 'failed').length < 2) {
        try {
          log.kernel('Attempting replan...');
          const newPlan = await replan(plan, step.id, err.message);
          // Replace remaining steps
          plan.steps = newPlan.steps;
          continue;
        } catch {
          log.warn('Replan failed, continuing with remaining steps');
        }
      }

      if (options.stopOnError) break;
    }
  }

  const summary = {
    execId,
    planId:     plan.id,
    goal:       plan.goal,
    totalSteps: sortedSteps.length,
    done:       stepLogs.filter(s => s.status === 'done').length,
    failed:     stepLogs.filter(s => s.status === 'failed').length,
    durationMs: Date.now() - start,
    finalResult,
    stepLogs,
    context:    ctx,
  };

  log.kernel(`Plan execution complete: ${summary.done}/${summary.totalSteps} steps ok (${elapsed(start)})`);
  return summary;
}

// ─── Topological Sort (respects dependsOn) ─────────────────
function topologicalSort(steps) {
  const idMap   = new Map(steps.map(s => [s.id, s]));
  const visited = new Set();
  const result  = [];

  function visit(step) {
    if (visited.has(step.id)) return;
    visited.add(step.id);
    for (const depId of (step.dependsOn || [])) {
      const dep = idMap.get(depId);
      if (dep) visit(dep);
    }
    result.push(step);
  }

  for (const step of steps) visit(step);
  return result;
}

// ─── Enrich input with ctx variables like {{step_1}} ──────
function enrichInput(input, ctx) {
  if (typeof input !== 'string') return input;
  return input.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = ctx[key];
    if (!val) return `{{${key}}}`;
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}