// ============================================================
//  agents/plannerAgent.js — Goal Planner Agent
// ============================================================
import { uuid, now } from '../shared/utils.js';

export async function run(input, options = {}) {
  const goal = typeof input === 'string' ? input : input.goal || input.task || '';
  const lower = goal.toLowerCase();

  const steps = [
    { order: 1, type: 'research', description: 'Collect domain context and constraints.' },
  ];

  if (/code|build|implement|api|function|fix/.test(lower)) {
    steps.push({ order: 2, type: 'coding', description: 'Generate implementation and run checks.' });
  }

  if (/data|analysis|analytics|csv|json|metric/.test(lower)) {
    steps.push({ order: steps.length + 1, type: 'data', description: 'Analyze and structure data output.' });
  }

  steps.push({ order: steps.length + 1, type: 'security', description: 'Run security review and risk checks.' });
  steps.push({ order: steps.length + 1, type: 'critic', description: 'Evaluate completeness and quality.' });

  return {
    agentId: options.agentId || uuid(),
    type: 'planner',
    goal,
    steps,
    timestamp: now(),
  };
}
