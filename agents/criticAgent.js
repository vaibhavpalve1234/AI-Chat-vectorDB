// ============================================================
//  agents/criticAgent.js — Output Critic Agent
// ============================================================
import { uuid, now } from '../shared/utils.js';

export async function run(input, options = {}) {
  const deps = typeof input === 'object' ? input.deps || {} : {};
  const outputs = Object.values(deps);
  const text = JSON.stringify(outputs);

  const score = computeScore(outputs, text);

  return {
    agentId: options.agentId || uuid(),
    type: 'critic',
    score,
    pass: score >= 70,
    feedback: score >= 70 ? 'Output quality is acceptable.' : 'Add more concrete outputs, sources, and validation steps.',
    timestamp: now(),
  };
}

function computeScore(outputs, text) {
  let score = 40;
  if (outputs.length >= 3) score += 20;
  if (text.length > 400) score += 15;
  if (/source|http|result|summary|pass|findings/i.test(text)) score += 15;
  return Math.min(score, 100);
}
