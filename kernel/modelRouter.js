// ============================================================
//  kernel/modelRouter.js — Dynamic Model Routing for Super-Agent
// ============================================================
import { Config } from '../config/index.js';

function hasOpenAI() { return !!process.env.OPENAI_API_KEY; }
function hasClaude() { return !!process.env.ANTHROPIC_API_KEY; }
function hasHF() { return !!process.env.HF_API_KEY; }

function isValid(model) {
  return ['openai', 'claude', 'huggingface', 'ollama'].includes(model);
}

export function selectModel(task = {}, constraints = {}) {
  const hint = task.modelHint || constraints.model;
  if (hint && isValid(hint)) return hint;

  if (task.type === 'coding' || task.type === 'security') {
    if (hasOpenAI()) return 'openai';
    if (hasClaude()) return 'claude';
    return 'ollama';
  }

  if (task.type === 'research' || task.type === 'data') {
    if (hasOpenAI()) return 'openai';
    if (hasHF()) return 'huggingface';
    return 'ollama';
  }

  if (hasOpenAI()) return 'openai';
  if (hasClaude()) return 'claude';
  if (hasHF()) return 'huggingface';
  return Config.models.default || 'ollama';
}

export function routePlanModels(nodes = [], constraints = {}) {
  return nodes.map((n) => ({ ...n, model: selectModel(n, constraints) }));
}
