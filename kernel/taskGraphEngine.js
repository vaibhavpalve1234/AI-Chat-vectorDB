// ============================================================
//  kernel/taskGraphEngine.js — Graph Builder + Executor
// ============================================================
import { uuid, now } from '../shared/utils.js';
import { spawnAgent } from './agentScheduler.js';
import { remember } from './memoryManager.js';
import { selectModel, routePlanModels } from './modelRouter.js';
import { getAllowedTools } from './toolManager.js';

export function buildTaskGraph(goal, options = {}) {
  const base = String(goal || '').toLowerCase();

  const nodes = [
    node('plan', 'planner', { goal }),
    node('research', 'research', { query: goal }, ['plan']),
  ];

  if (/code|build|implement|script|api|function|bug|fix/.test(base)) {
    nodes.push(node('code', 'coding', { task: goal }, ['plan', 'research']));
  }

  if (/data|csv|json|analytics|analy[sz]e|metric/.test(base)) {
    nodes.push(node('data', 'data', { task: goal }, ['research']));
  }

  nodes.push(node('security', 'security', { task: goal }, ['research']));
  nodes.push(node('critic', 'critic', { task: goal }, nodes.map((n) => n.id)));

  const withModels = routePlanModels(nodes, options.constraints || {});
  return {
    id: uuid(),
    goal,
    createdAt: now(),
    nodes: withModels,
  };
}

export async function executeTaskGraph(graph, options = {}) {
  const results = {};
  const trace = [];
  const ordered = topological(graph.nodes);

  for (const n of ordered) {
    const start = Date.now();
    const deps = Object.fromEntries((n.deps || []).map((id) => [id, results[id]]));
    const input = { ...n.input, deps, goal: graph.goal };

    const tools = getAllowedTools(n.agent, n.toolHints || []);
    const model = n.model || selectModel(n, options.constraints || {});

    try {
      const { promise } = await spawnAgent(n.agent, input, { model, tools, timeoutMs: options.timeoutMs });
      const output = await promise;
      results[n.id] = output;
      trace.push({ nodeId: n.id, type: n.type, status: 'done', durationMs: Date.now() - start });
      await remember(JSON.stringify({ nodeId: n.id, type: n.type, output }).slice(0, 3500), {
        source: 'super-agent',
        graphId: graph.id,
        nodeType: n.type,
      }).catch(() => {});
    } catch (err) {
      results[n.id] = { error: err.message };
      trace.push({ nodeId: n.id, type: n.type, status: 'failed', error: err.message, durationMs: Date.now() - start });
      if (options.stopOnError) break;
    }
  }

  return { graphId: graph.id, goal: graph.goal, results, trace, completedAt: now() };
}

function node(type, agent, input, deps = []) {
  return {
    id: uuid(),
    type,
    agent,
    input,
    deps,
    toolHints: [],
  };
}

function topological(nodes = []) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set();
  const sorted = [];

  function visit(n) {
    if (visited.has(n.id)) return;
    visited.add(n.id);
    (n.deps || []).forEach((d) => map.get(d) && visit(map.get(d)));
    sorted.push(n);
  }

  nodes.forEach(visit);
  return sorted;
}
