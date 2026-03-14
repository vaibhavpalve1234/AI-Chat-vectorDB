// ============================================================
//  agents/dataAgent.js — Data Processing Agent
// ============================================================
import { uuid, now } from '../shared/utils.js';

export async function run(input, options = {}) {
  const task = typeof input === 'string' ? input : (input.task || input.goal || '');
  const payload = typeof input === 'object' ? (input.payload || input.deps || {}) : {};

  const summary = summarize(payload);

  return {
    agentId: options.agentId || uuid(),
    type: 'data',
    task,
    summary,
    timestamp: now(),
  };
}

function summarize(value) {
  const text = JSON.stringify(value);
  const nums = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const count = nums.length;
  const min = count ? Math.min(...nums) : null;
  const max = count ? Math.max(...nums) : null;
  const avg = count ? nums.reduce((a, b) => a + b, 0) / count : null;

  return {
    payloadSize: text.length,
    numericCount: count,
    min,
    max,
    average: avg,
  };
}
