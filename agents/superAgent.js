// ============================================================
//  agents/superAgent.js — Top-level autonomous orchestrator
// ============================================================
import { uuid, now } from '../shared/utils.js';
import { buildTaskGraph, executeTaskGraph } from '../kernel/taskGraphEngine.js';

export async function run(input, options = {}) {
  const goal = typeof input === 'string' ? input : (input.goal || input.task || '');
  const graph = buildTaskGraph(goal, { constraints: input?.constraints || options?.constraints || {} });
  const execution = await executeTaskGraph(graph, options);

  return {
    agentId: options.agentId || uuid(),
    type: 'super',
    goal,
    graph,
    execution,
    timestamp: now(),
  };
}
