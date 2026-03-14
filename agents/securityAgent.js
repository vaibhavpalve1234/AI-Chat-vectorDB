// ============================================================
//  agents/securityAgent.js — Security Review Agent
// ============================================================
import { uuid, now } from '../shared/utils.js';

const RISK_RULES = [
  { id: 'secrets', rx: /(api[_-]?key|secret|token|password)/i, msg: 'Potential secret exposure in task/input.' },
  { id: 'command', rx: /(rm -rf|sudo\s|chmod\s777|curl\s.+\|\s*sh)/i, msg: 'Potentially dangerous command pattern detected.' },
  { id: 'sql', rx: /(drop\s+table|delete\s+from\s+\w+\s*;)/i, msg: 'Potential destructive SQL pattern detected.' },
];

export async function run(input, options = {}) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const findings = RISK_RULES.filter((r) => r.rx.test(text)).map((r) => ({ id: r.id, severity: 'medium', message: r.msg }));

  return {
    agentId: options.agentId || uuid(),
    type: 'security',
    pass: findings.length === 0,
    findings,
    recommendation: findings.length ? 'Sanitize inputs and remove sensitive or destructive operations.' : 'No obvious high-risk pattern detected.',
    timestamp: now(),
  };
}
