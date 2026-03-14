// ============================================================
//  tools/index.js — Tool Registry
// ============================================================
import { log } from '../shared/logger.js';
import { bus, Events } from '../shared/events.js';

const _tools = new Map();

export function registerTool(def) {
  if (!def.name || !def.execute) throw new Error('Tool must have name + execute');
  _tools.set(def.name, def);
  log.tool(def.name, 'registered');
}

export async function executeTool(name, params = {}) {
  const tool = _tools.get(name);
  if (!tool) throw new Error(`Tool not found: "${name}"`);

  const start = Date.now();
  log.tool(name, `calling with ${JSON.stringify(params).slice(0, 80)}`);
  bus.emit(Events.TOOL_CALLED, { name, params });

  try {
    const result = await tool.execute(params);
    bus.emit(Events.TOOL_RESULT, { name, result, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    bus.emit(Events.TOOL_ERROR, { name, error: err.message });
    throw err;
  }
}

export async function executeMany(calls) {
  const results = await Promise.allSettled(
    calls.map(({ name, params }) =>
      executeTool(name, params).then(result => ({ name, result }))
    )
  );
  return results.map((r, i) => ({
    name:   calls[i].name,
    result: r.status === 'fulfilled' ? r.value.result : null,
    error:  r.status === 'rejected'  ? r.reason.message : null,
  }));
}

export function listTools() {
  return Array.from(_tools.values()).map(({ name, description, schema }) => ({ name, description, schema }));
}

export function getTool(name) { return _tools.get(name) || null; }

// Auto-load all tools
export async function loadAllTools() {
  const modules = ['./webSearch.js', './codeExecutor.js', './fileSystem.js', './apiCaller.js'];
  for (const mod of modules) {
    try { await import(mod); }
    catch (err) { log.warn(`Failed to load tool module ${mod}: ${err.message}`); }
  }
  log.tool('registry', `${_tools.size} tools loaded`);
}