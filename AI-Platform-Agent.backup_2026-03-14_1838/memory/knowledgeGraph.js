// ============================================================
//  memory/knowledgeGraph.js — Knowledge Graph
//  In-memory graph of entities + relationships, persisted to JSON
// ============================================================
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uuid, now }     from '../shared/utils.js';
import { log }           from '../shared/logger.js';

const __dir    = path.dirname(fileURLToPath(import.meta.url));
const KG_FILE  = path.resolve(__dir, '../data/knowledgeGraph.json');

// Graph state
let nodes = new Map();   // id → { id, label, type, content, createdAt, properties }
let edges = new Map();   // id → { id, from, to, relation, weight, createdAt }

export function initKnowledgeGraph() {
  loadFromDisk();
  log.memory(`KnowledgeGraph loaded — ${nodes.size} nodes, ${edges.size} edges`);
  return { ready: true, nodes: nodes.size, edges: edges.size };
}

// ─── Nodes ────────────────────────────────────────────────

export function addNode({ id, label, type = 'concept', content = '', properties = {} }) {
  const node = { id: id || uuid(), label, type, content, properties, createdAt: now() };
  nodes.set(node.id, node);
  saveToDisk();
  return node;
}

export function getNode(id) { return nodes.get(id) || null; }

export function findNodes(query) {
  const q = query.toLowerCase();
  return Array.from(nodes.values()).filter(n =>
    n.label?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
  );
}

export function updateNode(id, updates) {
  const node = nodes.get(id);
  if (!node) return null;
  const updated = { ...node, ...updates, id };
  nodes.set(id, updated);
  saveToDisk();
  return updated;
}

export function deleteNode(id) {
  nodes.delete(id);
  // Remove all edges touching this node
  for (const [eid, e] of edges) {
    if (e.from === id || e.to === id) edges.delete(eid);
  }
  saveToDisk();
}

// ─── Edges ────────────────────────────────────────────────

export function addEdge({ from, to, relation, weight = 1.0 }) {
  const edge = { id: uuid(), from, to, relation, weight, createdAt: now() };
  edges.set(edge.id, edge);
  saveToDisk();
  return edge;
}

export function getNeighbors(nodeId, direction = 'both') {
  const result = [];
  for (const edge of edges.values()) {
    if (direction !== 'out' && edge.to === nodeId) {
      result.push({ node: nodes.get(edge.from), edge, direction: 'in' });
    }
    if (direction !== 'in' && edge.from === nodeId) {
      result.push({ node: nodes.get(edge.to), edge, direction: 'out' });
    }
  }
  return result.filter(r => r.node);
}

// ─── Query ────────────────────────────────────────────────

export function queryGraph(query) {
  const matches = findNodes(query);
  if (!matches.length) return null;
  const best = matches[0];
  return {
    node:      best,
    neighbors: getNeighbors(best.id),
    content:   best.content,
  };
}

// ─── Subgraph ─────────────────────────────────────────────

export function getSubgraph(nodeId, depth = 2) {
  const visited  = new Set();
  const subNodes = [];
  const subEdges = [];

  function traverse(id, d) {
    if (d < 0 || visited.has(id)) return;
    visited.add(id);
    const node = nodes.get(id);
    if (node) subNodes.push(node);
    for (const { node: n, edge } of getNeighbors(id)) {
      subEdges.push(edge);
      traverse(n.id, d - 1);
    }
  }

  traverse(nodeId, depth);
  return { nodes: subNodes, edges: subEdges };
}

// ─── Stats ────────────────────────────────────────────────

export function getStats() {
  const types = {};
  for (const n of nodes.values()) types[n.type] = (types[n.type] || 0) + 1;
  return { nodes: nodes.size, edges: edges.size, byType: types };
}

// ─── Persistence ──────────────────────────────────────────

function saveToDisk() {
  try {
    const dir = path.dirname(KG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KG_FILE, JSON.stringify({
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    }, null, 2), 'utf-8');
  } catch (err) { log.warn('KG save failed', err.message); }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(KG_FILE)) return;
    const data = JSON.parse(fs.readFileSync(KG_FILE, 'utf-8'));
    nodes = new Map((data.nodes || []).map(n => [n.id, n]));
    edges = new Map((data.edges || []).map(e => [e.id, e]));
  } catch { log.warn('KG load failed, starting fresh'); }
}