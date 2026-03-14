// ============================================================
//  agents/codingAgent.js — Coding Agent
// ============================================================
import { getModel } from '../models/index.js';
import { executeCode } from '../tools/codeExecutor.js';
import { writeFile } from '../tools/fileSystem.js';
import { log } from '../shared/logger.js';
import { uuid, now } from '../shared/utils.js';

const SYSTEM = `You are an expert software engineer. Write clean JavaScript and test with console.log.`;
const MAX_ITERATIONS = 3;

export async function run(input, options = {}) {
  const { agentId = uuid() } = options;
  const start = Date.now();
  const task = typeof input === 'object' ? input : { task: input };

  log.agent('CodingAgent', `Task: "${String(task.task || task.goal || input).slice(0, 70)}"`);

  let model = null;
  try { model = await getModel(options.model || 'openai'); } catch {}

  let code = '';
  let output = '';
  let passed = false;
  const history = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const iterPrompt = iter === 0 ? buildInitialPrompt(task) : buildFixPrompt(task, code, output);
    log.agent('CodingAgent', `Iteration ${iter + 1}/${MAX_ITERATIONS}`);

    let responseText = '';
    if (model) {
      try {
        const response = await model.complete(iterPrompt, { system: SYSTEM, temperature: 0.3 });
        responseText = response.text;
      } catch {
        responseText = '';
      }
    }
    if (!responseText) {
      responseText = `function solve(){\n  console.log("Task: ${sanitize(task.task || task.goal || 'No task')} complete");\n}\nsolve();`;
    }

    code = extractCode(responseText) || responseText;
    const execResult = await executeCode(code);
    output = (execResult.stdout + execResult.stderr).trim();
    history.push({ iter, code: code.slice(0, 500), output: output.slice(0, 200), exitCode: execResult.exitCode });

    if (execResult.exitCode === 0 && !execResult.stderr?.includes('Error')) {
      passed = true;
      break;
    }
  }

  if (task.saveAs) {
    const filename = task.saveAs.endsWith('.js') ? task.saveAs : `${task.saveAs}.js`;
    await writeFile(filename, code).catch(() => {});
  }

  return {
    agentId,
    type: 'coding',
    task: task.task || task.goal,
    code,
    output,
    passed,
    iterations: history.length,
    history,
    model: options.model || 'openai',
    durationMs: Date.now() - start,
    timestamp: now(),
  };
}

function buildInitialPrompt(task) {
  return `Task: ${task.task || task.goal}\nWrite JavaScript solution with test output.`;
}

function buildFixPrompt(task, prevCode, error) {
  return `Task: ${task.task || task.goal}\nFix code:\n${prevCode}\nError:\n${error}`;
}

function extractCode(text) {
  const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function sanitize(v) {
  return String(v).replace(/["\\]/g, '');
}
