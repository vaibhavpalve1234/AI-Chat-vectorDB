// ============================================================
//  kernel/toolManager.js — Tool Permissions + Binding
// ============================================================
import { listTools } from '../tools/index.js';

const ROLE_ALLOWLIST = {
  planner: ['web_search', 'web_extract', 'github_crawler'],
  research: ['web_search', 'web_extract', 'api_call', 'github_crawler'],
  coding: ['execute_code', 'file_read', 'file_write', 'file_list'],
  data: ['api_call', 'file_read', 'file_write', 'file_list'],
  security: ['file_read', 'file_list', 'api_call'],
  critic: ['file_read', 'file_list'],
  tool: ['web_search', 'web_extract', 'execute_code', 'file_read', 'file_write', 'file_list', 'api_call', 'github_crawler', 'browser_automation'],
  super: ['web_search', 'web_extract', 'execute_code', 'file_read', 'file_write', 'file_list', 'api_call', 'github_crawler', 'browser_automation'],
};

export function getAllowedTools(agentType, requested = []) {
  const allowed = new Set(ROLE_ALLOWLIST[agentType] || []);
  if (!requested.length) return Array.from(allowed);
  return requested.filter((t) => allowed.has(t));
}

export function getToolCatalogByAgent(agentType) {
  const allowed = new Set(getAllowedTools(agentType));
  return listTools().filter((t) => allowed.has(t.name));
}

export function isToolAllowed(agentType, toolName) {
  return getAllowedTools(agentType).includes(toolName);
}
