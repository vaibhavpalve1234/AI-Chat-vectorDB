// ============================================================
//  agents/toolAgent.js — Tool-Use Agent
//  Given a goal, decides which tools to call and uses them
// ============================================================
import { getModel }      from '../models/index.js';
import { listTools, executeTool, executeMany } from '../tools/index.js';
import { log }           from '../shared/logger.js';
import { safeJson, uuid, now } from '../shared/utils.js';
import { bus, Events }   from '../shared/events.js';

const SYSTEM = `You are a tool-use agent. Given a task, decide which tools to call.
Available tools will be listed. Return ONLY a JSON array of tool calls.
Each call: { "tool": "tool_name", "params": { ... } }`;

export async function run(input, options = {}) {
  const { agentId = uuid() } = options;
  const start = Date.now();
  const task  = typeof input === 'object' ? input.task || input.goal || JSON.stringify(input) : input;

  log.agent('ToolAgent', `Task: "${String(task).slice(0, 70)}"`);

  const tools = listTools();
  const model = await getModel(options.model || 'openai');

  // Step 1: Plan which tools to call
  const planPrompt = `Task: "${task}"

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Return a JSON array of tool calls to complete this task:
[{ "tool": "name", "params": { ... } }]
Return [] if no tools are needed.`;

  const planRes  = await model.complete(planPrompt, { system: SYSTEM, temperature: 0.2 });
  const toolCalls = safeJson(planRes.text) || [];

  if (!toolCalls.length) {
    log.agent('ToolAgent', 'No tool calls needed, answering directly');
    const directRes = await model.complete(task, { temperature: 0.6 });
    return { agentId, type: 'tool', task, toolCalls: [], result: directRes.text, durationMs: Date.now() - start, timestamp: now() };
  }

  log.agent('ToolAgent', `Calling ${toolCalls.length} tools: ${toolCalls.map(c => c.tool).join(', ')}`);

  // Step 2: Execute tools in parallel
  const toolResults = await executeMany(
    toolCalls.map(c => ({ name: c.tool, params: c.params || {} }))
  );

  // Step 3: Synthesize tool results into final answer
  const toolContext = toolResults
    .map(r => `Tool: ${r.name}\n${r.error ? `Error: ${r.error}` : `Result: ${JSON.stringify(r.result).slice(0, 1000)}`}`)
    .join('\n\n');

  const synthRes = await model.complete(
    `Task: "${task}"\n\nTool results:\n${toolContext}\n\nSummarize the results and answer the task.`,
    { temperature: 0.4 }
  );

  return {
    agentId,
    type:       'tool',
    task,
    toolCalls,
    toolResults,
    result:     synthRes.text,
    model:      options.model || 'openai',
    durationMs: Date.now() - start,
    timestamp:  now(),
  };
}