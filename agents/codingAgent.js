// ============================================================
//  agents/codingAgent.js — Coding Agent
//  Writes, executes, tests, and iterates on code
// ============================================================
import { getModel }     from '../models/index.js';
import { executeCode }  from '../tools/codeExecutor.js';
import { writeFile, readFile } from '../tools/fileSystem.js';
import { log }          from '../shared/logger.js';
import { safeJson, uuid, now } from '../shared/utils.js';
import { bus, Events }  from '../shared/events.js';

const SYSTEM = `You are an expert software engineer. Write clean, correct, well-commented code.
When asked to solve a problem, write the solution in JavaScript.
Always test your logic with console.log statements to verify correctness.`;

const MAX_ITERATIONS = 3;

export async function run(input, options = {}) {
  const { agentId = uuid() } = options;
  const start = Date.now();
  const task  = typeof input === 'object' ? input : { task: input };
  log.agent('CodingAgent', `Task: "${String(task.task || task.goal || input).slice(0, 70)}"`);

  const model   = await getModel(options.model || 'openai');
  let   code    = '';
  let   output  = '';
  let   passed  = false;
  const history = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const iterPrompt = iter === 0
      ? buildInitialPrompt(task)
      : buildFixPrompt(task, code, output);

    log.agent('CodingAgent', `Iteration ${iter + 1}/${MAX_ITERATIONS}`);
    const response = await model.complete(iterPrompt, { system: SYSTEM, temperature: 0.3 });

    // Extract code from response
    code = extractCode(response.text) || response.text;

    // Execute
    const execResult = await executeCode(code);
    output = (execResult.stdout + execResult.stderr).trim();
    history.push({ iter, code: code.slice(0, 500), output: output.slice(0, 200), exitCode: execResult.exitCode });

    log.agent('CodingAgent', `Exit ${execResult.exitCode} | output: ${output.slice(0, 80)}`);

    if (execResult.exitCode === 0 && !execResult.stderr?.includes('Error')) {
      passed = true;
      break;
    }
  }

  // Optionally save to workspace
  if (task.saveAs) {
    const filename = task.saveAs.endsWith('.js') ? task.saveAs : `${task.saveAs}.js`;
    await writeFile(filename, code).catch(() => {});
    log.agent('CodingAgent', `Saved to workspace/${filename}`);
  }

  return {
    agentId,
    type:       'coding',
    task:       task.task || task.goal,
    code,
    output,
    passed,
    iterations: history.length,
    history,
    model:      options.model || 'openai',
    durationMs: Date.now() - start,
    timestamp:  now(),
  };
}

function buildInitialPrompt(task) {
  return `Task: ${task.task || task.goal}
${task.requirements ? `Requirements:\n${task.requirements}` : ''}
${task.language ? `Language: ${task.language}` : 'Language: JavaScript'}

Write the complete solution with test output using console.log.`;
}

function buildFixPrompt(task, prevCode, error) {
  return `Fix this code that has an error.

Task: ${task.task || task.goal}

Previous code:
\`\`\`javascript
${prevCode}
\`\`\`

Error output:
${error}

Fix the code and return the complete corrected version.`;
}

function extractCode(text) {
  const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}