// ============================================================
//  kernel/memoryManager.js — Unified Memory Manager
//  Single interface for: vector DB, knowledge graph, file cache
// ============================================================
import { log }      from '../shared/logger.js';
import { bus, Events } from '../shared/events.js';
import { uuid, now } from '../shared/utils.js';
import { Config }   from '../config/index.js';

// Lazy imports to keep startup fast
let _vectorDB   = null;
let _kgraph     = null;
let _fileCache  = null;

export async function initMemoryManager() {
  const [vdb, kg, fc] = await Promise.all([
    import('../memory/vectorDB.js').then(m => m.initVectorDB()),
    import('../memory/knowledgeGraph.js').then(m => m.initKnowledgeGraph()),
    import('../memory/datasetStore.js').then(m => { m.initDatasetStore(); return { ready: true }; }),
  ]);
  _vectorDB  = await import('../memory/vectorDB.js');
  _kgraph    = await import('../memory/knowledgeGraph.js');
  _fileCache = await import('../memory/datasetStore.js');

  log.kernel('Memory manager ready: vectorDB + knowledgeGraph + datasetStore');
  bus.emit(Events.SYSTEM_READY, { component: 'memory' });
  return { vectorDB: vdb, knowledgeGraph: kg };
}

// ─── Smart lookup: vector DB → knowledge graph → miss ──────

/**
 * Look up a query across all memory layers.
 * Returns the first strong match or null.
 */
export async function recall(query, options = {}) {
  const { topK = 5, threshold = Config.memory.cacheHit } = options;

  // 1. Vector DB semantic search
  if (_vectorDB) {
    try {
      const { results } = await _vectorDB.semanticSearch('KNOWLEDGE', query, topK);
      const best = results.find(r => r.score >= threshold);
      if (best) {
        log.memory(`RECALL HIT (vector) score=${best.score.toFixed(2)}: "${query.slice(0, 60)}"`);
        bus.emit(Events.CACHE_HIT, { query, score: best.score, source: 'vector' });
        return { hit: true, source: 'vector', score: best.score, data: best };
      }
    } catch (err) {
      log.warn('Vector recall failed', err.message);
    }
  }

  // 2. Knowledge graph entity lookup
  if (_kgraph) {
    try {
      const kgResult = await _kgraph.queryGraph(query);
      if (kgResult) {
        log.memory(`RECALL HIT (knowledge graph): "${query.slice(0, 60)}"`);
        bus.emit(Events.CACHE_HIT, { query, source: 'kg' });
        return { hit: true, source: 'kg', data: kgResult };
      }
    } catch {}
  }

  bus.emit(Events.CACHE_MISS, { query });
  return { hit: false };
}

/** Store a new memory entry across backends. */
export async function remember(content, metadata = {}) {
  const id  = uuid();
  const doc = { id, text: content, metadata: { ...metadata, timestamp: now() } };

  const saves = [];

  if (_vectorDB) {
    const ready = typeof _vectorDB.isReady === 'function' ? _vectorDB.isReady() : false;
    if (!ready) {
      log.warn(`VectorDB not ready; skipping vector insert. Start ChromaDB at ${Config.memory.chromaUrl}`);
    } else {
      saves.push(
        _vectorDB.addDocument('KNOWLEDGE', doc)
          .catch(err => log.warn('Vector save failed', err.message))
      );
    }
  }

  if (_kgraph && metadata.entities) {
    saves.push(
      _kgraph.addNode({ id, content, entities: metadata.entities })
        .catch(err => log.warn('KG save failed', err.message))
    );
  }

  await Promise.allSettled(saves);
  bus.emit(Events.MEMORY_SAVED, { id, content: content.slice(0, 100) });
  log.memory(`Stored memory: id=${id.slice(0, 8)}`);
  return id;
}

/** Semantic search returning ranked results. */
export async function search(query, topK = 5) {
  if (!_vectorDB) return { results: [] };
  try {
    return _vectorDB.semanticSearch('KNOWLEDGE', query, topK);
  } catch {
    return { results: [] };
  }
}

/** Get full memory stats. */
export async function getMemoryStats() {
  const stats = { vectorDB: null, knowledgeGraph: null, datasetStore: null };
  if (_vectorDB)  stats.vectorDB   = await _vectorDB.getStats().catch(() => null);
  if (_kgraph)    stats.knowledgeGraph = _kgraph.getStats();
  if (_fileCache) stats.datasetStore  = _fileCache.getStats();
  return stats;
}
