// ============================================================
//  memory/vectorDB.js — ChromaDB Vector Database
// ============================================================
import { ChromaClient } from 'chromadb';
import { Config }       from '../config/index.js';
import { log }          from '../shared/logger.js';
import { getModel }     from '../models/index.js';

const COLLECTIONS = {
  KNOWLEDGE:  'aios_knowledge',
  HISTORY:    'aios_history',
  CACHE:      'aios_cache',
  EVALS:      'aios_evals',
  DATASETS:   'aios_datasets',
  DOCUMENTS:  'aios_documents',
  MEDIA:      'aios_media',
};

let _client  = null;
const _cols  = {};
let   _ready = false;

export async function initVectorDB() {
  try {
    _client = new ChromaClient({ path: Config.memory.chromaUrl });
    await _client.heartbeat();

    for (const [key, name] of Object.entries(COLLECTIONS)) {
      _cols[key] = await _client.getOrCreateCollection({ name, metadata: { hnsw_space: 'cosine' } });
    }

    _ready = true;
    const counts = await Promise.all(
      Object.entries(_cols).map(async ([k, c]) => `${k}:${await c.count()}`)
    );
    log.memory(`VectorDB ready — ${counts.join(' | ')}`);
    return { ready: true, collections: Object.keys(COLLECTIONS) };
  } catch (err) {
    _ready = false;
    log.warn('VectorDB offline (ChromaDB not running) — vector search disabled', err.message);
    return { ready: false };
  }
}

export function isReady() { return _ready; }

async function embed(text) {
  const model = await getModel(Config.models.embeddingsProvider || 'openai');
  return model.embed(Array.isArray(text) ? text : [text]).then(r => Array.isArray(r[0]) ? r : [r]);
}

export async function addDocument(collection, doc) {
  if (!_ready) return;
  try {
    const colKey = resolveCollection(collection);
    const [embedding] = await embed(doc.text);
    await _cols[colKey].add({
      ids:        [doc.id],
      embeddings: [embedding],
      documents:  [doc.text],
      metadatas:  [{ ...doc.metadata, ts: new Date().toISOString() }],
    });
  } catch (err) {
    log.warn(`VectorDB add failed [${collection}]`, err.message);
    throw err;
  }
}

export async function addDocuments(collection, docs) {
  if (!_ready || !docs.length) return;
  try {
    const colKey = resolveCollection(collection);
    const texts = docs.map(d => d.text);
    const embeddings = await embed(texts).then(r => r);
    await _cols[colKey].add({
      ids:        docs.map(d => d.id),
      embeddings,
      documents:  texts,
      metadatas:  docs.map(d => ({ ...d.metadata, ts: new Date().toISOString() })),
    });
  } catch (err) {
    log.warn('VectorDB batch add failed', err.message);
    throw err;
  }
}

export async function semanticSearch(collection, query, topK = 5, filter = null) {
  if (!_ready) return { available: false, results: [] };
  try {
    const col = _cols[resolveCollection(collection)];
    if (!col) return { available: false, results: [] };
    const count = await col.count();
    if (count === 0) return { available: true, results: [] };

    const [embedding] = await embed(query);
    const params = { queryEmbeddings: [embedding], nResults: Math.min(topK, count) };
    if (filter) params.where = filter;

    const res = await col.query(params);
    const results = (res.ids[0] || []).map((id, i) => ({
      id,
      text:     res.documents[0][i],
      metadata: res.metadatas[0][i],
      score:    1 - (res.distances?.[0]?.[i] ?? 1),
    }));
    return { available: true, results };
  } catch (err) {
    log.warn('VectorDB search failed', err.message);
    return { available: false, results: [] };
  }
}

export async function deleteDocument(collection, id) {
  if (!_ready) return;
  try { await _cols[resolveCollection(collection)].delete({ ids: [id] }); } catch {}
}

function resolveCollection(collection) {
  if (!collection) return 'KNOWLEDGE';
  if (_cols[collection]) return collection;
  const key = String(collection).toUpperCase();
  if (_cols[key]) return key;
  const byName = Object.entries(COLLECTIONS).find(([, name]) => name === collection)?.[0];
  return byName || 'KNOWLEDGE';
}

export async function getStats() {
  if (!_ready) return { ready: false };
  const counts = {};
  for (const [key, col] of Object.entries(_cols)) {
    counts[key] = await col.count().catch(() => 0);
  }
  return { ready: true, collections: counts };
}

export { COLLECTIONS };
