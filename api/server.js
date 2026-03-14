// ============================================================
//  api/server.js — Express REST + WebSocket API Server
//
//  Endpoints:
//    POST /api/run          — Submit a goal for planning + execution
//    POST /api/agent        — Spawn a specific agent directly
//    GET  /api/agents       — List all agent records
//    GET  /api/agents/:id   — Get agent status
//    DELETE /api/agents/:id — Cancel an agent
//    POST /api/task         — Enqueue a queue task
//    GET  /api/tasks        — List queue tasks
//    GET  /api/memory/search— Semantic search memory
//    POST /api/memory       — Store a memory entry
//    GET  /api/tools        — List available tools
//    POST /api/tools/:name  — Execute a tool directly
//    GET  /api/metrics      — System metrics
//    GET  /api/health       — Health check
//    WS   /ws               — Real-time event stream
// ============================================================
import 'dotenv/config';
import express       from 'express';
import { WebSocketServer } from 'ws';
import { createServer }    from 'http';
import { readFileSync }    from 'fs';
import { fileURLToPath }   from 'url';
import path                from 'path';
import chalk         from 'chalk';

const __dir = path.dirname(fileURLToPath(import.meta.url));

import { Config }    from '../config/index.js';
import { log }       from '../shared/logger.js';
import { bus, Events } from '../shared/events.js';

// Kernel
import { initMemoryManager }   from '../kernel/memoryManager.js';
import { spawnAgent, getAgentStatus, listAgents, cancelAgent, getSchedulerStats } from '../kernel/agentScheduler.js';
import { plan }                from '../kernel/planner.js';
import { executePlan }         from '../kernel/executor.js';
import { buildTaskGraph, executeTaskGraph } from '../kernel/taskGraphEngine.js';

// Queue
import { enqueue, getTask, cancelTask, listTasks, getQueueStats, startWorker } from '../queue/taskQueue.js';

// Memory
import { recall, remember, search, getMemoryStats } from '../kernel/memoryManager.js';
import { ingestMultimodalItem, ingestMultimodalBatch, searchMultimodal, listModalities } from '../rag/multimodalIndexer.js';

// Tools
import { listTools, executeTool, loadAllTools } from '../tools/index.js';

// Analytics
import { initAnalytics, getMetricsJson } from '../dashboard/analytics.js';

// ─── App setup ────────────────────────────────────────────
const app    = express();
const server = createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  Config.api.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Serve dashboard ──────────────────────────────────────
app.get('/', (_req, res) => {
  res.sendFile(path.resolve(__dir, '../dashboard/index.html'));
});
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.resolve(__dir, '../dashboard/index.html'));
});

// Request logger
app.use((req, _res, next) => {
  log.api(`${req.method} ${req.path}`);
  next();
});

// ─── Helper ───────────────────────────────────────────────
const ok   = (res, data)   => res.json({ ok: true,  ...data });
const fail = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

// ─── Routes ───────────────────────────────────────────────

// Health
app.get('/api/health', (_req, res) => ok(res, {
  status:    'healthy',
  version:   '1.0.0',
  timestamp: new Date().toISOString(),
  uptime:    process.uptime(),
}));

// ── Super-Agent: task graph autonomous execution ───────────
app.post('/api/super/run', async (req, res) => {
  const { goal, constraints = {}, stopOnError = false } = req.body;
  if (!goal) return fail(res, 'goal is required');
  try {
    const graph = buildTaskGraph(goal, { constraints });
    const execution = await executeTaskGraph(graph, { constraints, stopOnError });
    ok(res, { graph, execution });
  } catch (err) {
    fail(res, err.message, 500);
  }
});

// ── Goal: plan + execute ──────────────────────────────────
app.post('/api/run', async (req, res) => {
  const { goal, model, replanOnFailure = true } = req.body;
  if (!goal) return fail(res, 'goal is required');
  try {
    const thePlan = await plan(goal, { model });
    const result  = await executePlan(thePlan, { model, replanOnFailure });
    ok(res, { plan: thePlan, execution: result });
  } catch (err) { fail(res, err.message, 500); }
});

// ── Agents ───────────────────────────────────────────────
app.post('/api/agent', async (req, res) => {
  const { type, input, options = {} } = req.body;
  if (!type || !input) return fail(res, 'type and input are required');
  try {
    const { id, promise } = await spawnAgent(type, input, options);
    // Return id immediately; client can poll or use WS for result
    ok(res, { agentId: id, status: 'spawned' });
    // Fire and forget — result will be emitted on bus
    promise.catch(() => {});
  } catch (err) { fail(res, err.message, 500); }
});

app.get('/api/agents', (_req, res) => {
  ok(res, { agents: listAgents(), stats: getSchedulerStats() });
});

app.get('/api/agents/:id', (req, res) => {
  const rec = getAgentStatus(req.params.id);
  if (!rec) return fail(res, 'Agent not found', 404);
  ok(res, { agent: rec });
});

app.delete('/api/agents/:id', (req, res) => {
  const cancelled = cancelAgent(req.params.id);
  ok(res, { cancelled });
});

// ── Tasks (Queue) ─────────────────────────────────────────
app.post('/api/task', (req, res) => {
  const { type, payload, priority, tags } = req.body;
  if (!type || payload === undefined) return fail(res, 'type and payload are required');
  const id = enqueue(type, payload, { priority, tags });
  ok(res, { taskId: id });
});

app.get('/api/tasks', (req, res) => {
  const { status, type, limit } = req.query;
  ok(res, { tasks: listTasks({ status, type, limit: parseInt(limit) || 50 }), stats: getQueueStats() });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return fail(res, 'Task not found', 404);
  ok(res, { task });
});

app.delete('/api/tasks/:id', (req, res) => {
  ok(res, { cancelled: cancelTask(req.params.id) });
});

// ── Memory ───────────────────────────────────────────────
app.get('/api/memory/search', async (req, res) => {
  const { q, topK = 5 } = req.query;
  if (!q) return fail(res, 'q is required');
  try {
    const result = await search(q, parseInt(topK));
    ok(res, result);
  } catch (err) { fail(res, err.message, 500); }
});

app.post('/api/memory', async (req, res) => {
  const { content, metadata } = req.body;
  if (!content) return fail(res, 'content is required');
  try {
    const id = await remember(content, metadata);
    ok(res, { id });
  } catch (err) { fail(res, err.message, 500); }
});

app.get('/api/memory/stats', async (_req, res) => {
  try { ok(res, await getMemoryStats()); }
  catch (err) { fail(res, err.message, 500); }
});


// ── Vector DB Multimodal ─────────────────────────────────
app.get('/api/vector/modalities', (_req, res) => {
  ok(res, { modalities: listModalities() });
});

app.post('/api/vector/ingest', async (req, res) => {
  const { item, collection, chunkSize, overlap } = req.body;
  if (!item) return fail(res, 'item is required');
  try {
    const result = await ingestMultimodalItem(item, { collection, chunkSize, overlap });
    ok(res, result);
  } catch (err) { fail(res, err.message, 500); }
});

app.post('/api/vector/ingest/batch', async (req, res) => {
  const { items = [], collection, chunkSize, overlap } = req.body;
  if (!Array.isArray(items) || !items.length) return fail(res, 'items[] is required');
  try {
    const result = await ingestMultimodalBatch(items, { collection, chunkSize, overlap });
    ok(res, result);
  } catch (err) { fail(res, err.message, 500); }
});

app.get('/api/vector/search', async (req, res) => {
  const { q, topK = 8, collection = 'MEDIA', types = '' } = req.query;
  if (!q) return fail(res, 'q is required');

  const parsedTypes = String(types || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const result = await searchMultimodal(String(q), {
      topK: parseInt(topK),
      collection: String(collection),
      types: parsedTypes,
    });
    ok(res, result);
  } catch (err) { fail(res, err.message, 500); }
});

// ── Tools ─────────────────────────────────────────────────
app.get('/api/tools', (_req, res) => {
  ok(res, { tools: listTools() });
});

app.post('/api/tools/:name', async (req, res) => {
  try {
    const result = await executeTool(req.params.name, req.body);
    ok(res, { result });
  } catch (err) { fail(res, err.message, 500); }
});

// ── Metrics ───────────────────────────────────────────────
app.get('/api/metrics', async (_req, res) => {
  try { ok(res, await getMetricsJson()); }
  catch (err) { fail(res, err.message, 500); }
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => fail(res, `Route not found: ${req.method} ${req.path}`, 404));

// ─── WebSocket — real-time event stream ───────────────────
if (Config.api.wsEnabled) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    log.api(`WS client connected: ${req.socket.remoteAddress}`);

    // Forward all bus events to this client
    const forward = (event) => (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event, data, ts: new Date().toISOString() }));
      }
    };

    const subs = Object.values(Events).map(event => {
      const handler = forward(event);
      bus.on(event, handler);
      return { event, handler };
    });

    ws.on('close', () => {
      subs.forEach(({ event, handler }) => bus.off(event, handler));
      log.api('WS client disconnected');
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch {}
    });

    ws.send(JSON.stringify({ event: 'connected', data: { message: 'AI-OS event stream ready' } }));
  });
}

// ─── Boot ─────────────────────────────────────────────────
async function boot() {
  console.log(chalk.bold.cyan('\n  🤖 AI-OS Booting...\n'));

  // 1. Init memory
  await initMemoryManager();

  // 2. Load tools
  await loadAllTools();

  // 3. Init analytics
  initAnalytics();

  // 4. Start queue worker with agent handlers
  startWorker({
    research:   (payload) => import('../agents/researchAgent.js').then(m => m.run(payload)),
    coding:     (payload) => import('../agents/codingAgent.js').then(m => m.run(payload)),
    evaluation: (payload) => import('../agents/evaluationAgent.js').then(m => m.run(payload)),
    tool:       (payload) => import('../agents/toolAgent.js').then(m => m.run(payload)),
  });

  // 5. Start HTTP server
  server.listen(Config.api.port, Config.api.host, () => {
    console.log(chalk.bold.green(`\n  ✔ AI-OS running at       http://${Config.api.host}:${Config.api.port}`));
    console.log(chalk.bold.cyan( `  ✔ Dashboard at           http://localhost:${Config.api.port}`));
    console.log(chalk.gray(      `  ✔ WebSocket stream at    ws://${Config.api.host}:${Config.api.port}/ws`));
    console.log(chalk.cyan('\n  Endpoints:'));
    [
      'POST /api/run           — Plan + execute a goal',
      'POST /api/agent         — Spawn agent directly',
      'GET  /api/agents        — List all agents',
      'POST /api/task          — Enqueue a queue task',
      'GET  /api/tasks         — List queue tasks',
      'GET  /api/memory/search?q= — Semantic search',
      'POST /api/memory        — Store memory',
      'GET  /api/tools         — List tools',
      'POST /api/tools/:name   — Execute a tool',
      'GET  /api/metrics       — System metrics',
      'GET  /api/health        — Health check',
    ].forEach(e => console.log(chalk.gray(`    ${e}`)));
    console.log('');
    bus.emit(Events.SYSTEM_READY, { component: 'api', port: Config.api.port });
  });
}

boot().catch(err => {
  console.error(chalk.red('\nFatal boot error:'), err);
  process.exit(1);
});

export { app, server };