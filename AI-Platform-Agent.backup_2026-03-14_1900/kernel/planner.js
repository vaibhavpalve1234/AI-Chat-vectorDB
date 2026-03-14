// ============================================================
//  kernel/planner.js — Task Planner
//  Converts a high-level goal into an ordered plan of steps
//  using LLM reasoning + tool catalog awareness
// ============================================================
import { log }       from '../shared/logger.js';
import { safeJson, uuid, now } from '../shared/utils.js';
import { getModel }  from '../models/index.js';
import { listTools } from '../tools/index.js';

const PLANNER_SYSTEM = `You are a task planner for an AI operating system.
Given a goal, break it into clear, ordered steps.
Each step must specify: which agent type to use, what input to pass, and what tools (if any) to call.
Available agent types: research, coding, evaluation, tool
Return ONLY valid JSON — no prose, no markdown fences.`;

/**
 * Plan a goal into executable steps.
 *
 * @param {string} goal
 * @param {object} options
 * @returns {Promise<Plan>}
 *
 * Plan: { id, goal, steps: [{ id, order, type, description, input, tools, dependsOn }] }
 */
export async function plan(goal, options = {}) {
  const planId = uuid();
  log.kernel(`Planning goal: "${goal.slice(0, 80)}"`);

  const availableTools = listTools().map(t => `${t.name}: ${t.description}`).join('\n');
  const model = await getModel(options.model || 'openai');

  const prompt = `
Goal: "${goal}"

Available tools:
${availableTools}

Create an execution plan. Return JSON:
{
  "steps": [
    {
      "order": 1,
      "type": "research|coding|evaluation|tool",
      "description": "what this step does",
      "input": "what to pass to the agent",
      "tools": ["tool_name"],
      "dependsOn": []
    }
  ],
  "estimatedComplexity": "low|medium|high",
  "reasoning": "why this plan"
}`;

  try {
    const response = await model.complete(prompt, { system: PLANNER_SYSTEM, temperature: 0.3 });
    const parsed   = safeJson(response.text);

    if (!parsed?.steps) throw new Error('Planner returned invalid JSON');

    const steps = parsed.steps.map((s, i) => ({
      id:          uuid(),
      order:       s.order    ?? i + 1,
      type:        s.type     || 'tool',
      description: s.description,
      input:       s.input,
      tools:       s.tools    || [],
      dependsOn:   s.dependsOn || [],
      status:      'pending',
    }));

    const result = {
      id:          planId,
      goal,
      steps,
      estimatedComplexity: parsed.estimatedComplexity || 'medium',
      reasoning:   parsed.reasoning || '',
      createdAt:   now(),
    };

    log.kernel(`Plan created: ${steps.length} steps (${result.estimatedComplexity})`);
    return result;

  } catch (err) {
    log.error('Planner failed, using fallback single-step plan', err.message);
    return fallbackPlan(planId, goal);
  }
}

/**
 * Re-plan remaining steps when one step fails.
 */
export async function replan(originalPlan, failedStepId, error) {
  log.kernel(`Replanning after step ${failedStepId} failed: ${error}`);
  const remaining = originalPlan.steps.filter(s => s.status === 'pending' || s.id === failedStepId);

  const model  = await getModel('openai');
  const prompt = `
Original goal: "${originalPlan.goal}"
A step failed with error: "${error}"
Remaining steps: ${JSON.stringify(remaining, null, 2)}

Create a revised plan to recover and complete the goal.
Return JSON with same structure as before.`;

  try {
    const response = await model.complete(prompt, { system: PLANNER_SYSTEM, temperature: 0.4 });
    const parsed   = safeJson(response.text);
    if (!parsed?.steps) throw new Error('Replan returned invalid JSON');
    return { ...originalPlan, steps: parsed.steps.map((s, i) => ({ id: uuid(), ...s, status: 'pending' })) };
  } catch {
    log.warn('Replan failed, returning original remaining steps');
    return originalPlan;
  }
}

function fallbackPlan(planId, goal) {
  return {
    id:    planId,
    goal,
    steps: [{
      id:          uuid(),
      order:       1,
      type:        'research',
      description: 'Directly address the goal',
      input:       goal,
      tools:       [],
      dependsOn:   [],
      status:      'pending',
    }],
    estimatedComplexity: 'low',
    reasoning: 'Fallback single-step plan',
    createdAt: now(),
  };
}