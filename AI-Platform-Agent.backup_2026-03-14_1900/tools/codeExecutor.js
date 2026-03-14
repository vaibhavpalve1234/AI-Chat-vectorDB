// ============================================================
//  tools/codeExecutor.js — Safe Code Execution Tool
// ============================================================
import { execFile }      from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir }        from 'os';
import { join }          from 'path';
import { randomUUID }    from 'crypto';
import { registerTool }  from './index.js';
import { log }           from '../shared/logger.js';
import { Config }        from '../config/index.js';

export async function executeCode(code, language = 'javascript') {
  if (language !== 'javascript' && language !== 'js') {
    throw new Error(`Language "${language}" not supported. Use javascript.`);
  }

  const id   = randomUUID().slice(0, 8);
  const file = join(tmpdir(), `aios_exec_${id}.mjs`);
  const MAX  = Config.tools.maxOutputBytes;

  const wrapped = `
const _logs = [];
console.log = (...a) => _logs.push(['log', a.map(String).join(' ')]);
console.error = (...a) => _logs.push(['err', a.map(String).join(' ')]);
try { ${code} } catch(e) { console.error('RuntimeError: ' + e.message); }
for (const [t, m] of _logs) {
  if (t === 'log') process.stdout.write(m + '\\n');
  else process.stderr.write(m + '\\n');
}`;

  writeFileSync(file, wrapped, 'utf-8');

  return new Promise(resolve => {
    execFile(process.execPath, ['--no-warnings', file], {
      timeout: Config.tools.execTimeoutMs,
      maxBuffer: MAX,
      env: { PATH: process.env.PATH, NODE_ENV: 'sandbox' },
    }, (err, stdout, stderr) => {
      try { if (existsSync(file)) unlinkSync(file); } catch {}
      if (err?.killed) return resolve({ stdout: '', stderr: 'Timed out', exitCode: 124, timedOut: true });
      resolve({ stdout: stdout.slice(0, MAX), stderr: stderr.slice(0, MAX), exitCode: err?.code ?? 0 });
    });
  });
}

registerTool({
  name: 'execute_code',
  description: 'Execute JavaScript code safely and return stdout/stderr',
  schema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' } }, required: ['code'] },
  execute: ({ code, language }) => executeCode(code, language),
});