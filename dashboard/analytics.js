// ============================================================
//  dashboard/analytics.js — System Analytics Dashboard
//  Aggregates metrics from all subsystems into one report
// ============================================================
import { log }              from '../shared/logger.js';
import { bus, Events }      from '../shared/events.js';
import { getSchedulerStats, listAgents } from '../kernel/agentScheduler.js';
import { getQueueStats, listTasks }     from '../queue/taskQueue.js';
import { getStats as getStoreStats }    from '../memory/datasetStore.js';
import { loadHistory }                  from '../memory/datasetStore.js';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

// Live metrics store (updated via events)
const metrics = {
  cacheHits:   0,
  cacheMisses: 0,
  toolCalls:   0,
  toolErrors:  0,
  modelCalls:  0,
  agentsDone:  0,
  agentsFailed: 0,
  startedAt:   new Date().toISOString(),
};

// Subscribe to events for live metrics
export function initAnalytics() {
  bus.on(Events.CACHE_HIT,      () => metrics.cacheHits++);
  bus.on(Events.CACHE_MISS,     () => metrics.cacheMisses++);
  bus.on(Events.TOOL_CALLED,    () => metrics.toolCalls++);
  bus.on(Events.TOOL_ERROR,     () => metrics.toolErrors++);
  bus.on(Events.MODEL_REQUEST,  () => metrics.modelCalls++);
  bus.on(Events.AGENT_DONE,     () => metrics.agentsDone++);
  bus.on(Events.AGENT_ERROR,    () => metrics.agentsFailed++);
  log.success('Analytics initialized');
}

/** Get a full system snapshot. */
export async function getSnapshot() {
  const scheduler = getSchedulerStats();
  const queue     = getQueueStats();
  const store     = getStoreStats();
  const history   = loadHistory(100);

  const uptimeMs = Date.now() - new Date(metrics.startedAt).getTime();
  const cacheRate = metrics.cacheHits + metrics.cacheMisses > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
    : '0.0';

  return {
    uptime:    formatUptime(uptimeMs),
    timestamp: new Date().toISOString(),
    kernel:    scheduler,
    queue,
    store,
    metrics: { ...metrics, cacheHitRate: `${cacheRate}%` },
    history: {
      total: history.length,
      recentTasks: history.slice(0, 5).map(h => ({
        id:        h.id?.slice(0, 8),
        type:      h.type || h.agentType,
        timestamp: h.timestamp,
      })),
    },
  };
}

/** Print a full terminal dashboard. */
export async function printDashboard() {
  const snap = await getSnapshot();

  console.clear();
  console.log(boxen(
    chalk.bold.cyan(' AI-OS Dashboard') + chalk.gray(` v1.0 | uptime: ${snap.uptime}`),
    { padding: { left: 3, right: 3, top: 0, bottom: 0 }, borderColor: 'cyan', borderStyle: 'double' }
  ));

  // ── Kernel / Queue ──────────────────────────────────────
  const kernelTable = new Table({ head: ['Metric', 'Value'], colWidths: [22, 14] });
  kernelTable.push(
    ['Agents Total',    chalk.white(snap.kernel.total)],
    ['Running',         chalk.yellow(snap.kernel.running)],
    ['Completed',       chalk.green(snap.kernel.done)],
    ['Failed',          chalk.red(snap.kernel.failed)],
    ['Queue Pending',   chalk.yellow(snap.queue.pending)],
    ['Queue Done',      chalk.green(snap.queue.done)],
  );
  console.log('\n' + chalk.bold('⬡ Kernel & Queue'));
  console.log(kernelTable.toString());

  // ── Live Metrics ────────────────────────────────────────
  const metricsTable = new Table({ head: ['Metric', 'Value'], colWidths: [22, 14] });
  metricsTable.push(
    ['Cache Hit Rate',  chalk.cyan(snap.metrics.cacheHitRate)],
    ['Cache Hits',      chalk.green(snap.metrics.cacheHits)],
    ['Cache Misses',    chalk.yellow(snap.metrics.cacheMisses)],
    ['Tool Calls',      chalk.white(snap.metrics.toolCalls)],
    ['Tool Errors',     chalk.red(snap.metrics.toolErrors)],
    ['Model Calls',     chalk.magenta(snap.metrics.modelCalls)],
  );
  console.log('\n' + chalk.bold('◆ Live Metrics'));
  console.log(metricsTable.toString());

  // ── Storage ─────────────────────────────────────────────
  const storeTable = new Table({ head: ['Store', 'Count'], colWidths: [22, 14] });
  storeTable.push(
    ['History Entries', chalk.white(snap.store.historyCount)],
    ['Datasets',        chalk.white(snap.store.datasetCount)],
    ['Eval Categories', chalk.white(snap.store.evalCategories?.length || 0)],
  );
  console.log('\n' + chalk.bold('◎ Storage'));
  console.log(storeTable.toString());

  console.log(chalk.gray(`\n  Last updated: ${new Date().toLocaleTimeString()}\n`));
}

/** Return JSON-serializable metrics for the API. */
export async function getMetricsJson() {
  return getSnapshot();
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0)  return `${h}h ${m % 60}m`;
  if (m > 0)  return `${m}m ${s % 60}s`;
  return `${s}s`;
}