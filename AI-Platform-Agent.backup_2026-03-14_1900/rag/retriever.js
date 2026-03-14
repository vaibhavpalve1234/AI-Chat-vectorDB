// ============================================================
//  rag/retriever.js — Smart RAG Retriever
//
//  Lookup chain:
//    1. VectorDB semantic search (fast, local)
//    2. KnowledgeGraph entity lookup
//    3. Live web search (if enabled + Tavily key set)
//    → Build augmented prompt with all found context
// ============================================================
import { semanticSearch, COLLECTIONS, isReady } from '../memory/vectorDB.js';
import { queryGraph }   from '../memory/knowledgeGraph.js';
import { webSearch }    from '../tools/webSearch.js';
import { log }          from '../shared/logger.js';
import { Config }       from '../config/index.js';

const SIM_THRESHOLD = Config.memory.cacheHit || 0.75;

/**
 * Retrieve relevant context for a query from all sources.
 *
 * @param {string} query
 * @param {object} options
 * @returns {Promise<RetrievalResult>}
 */
export async function retrieve(query, options = {}) {
  const {
    topK         = 5,
    useWeb       = false,
    useKG        = true,
    useVector    = true,
    threshold    = SIM_THRESHOLD,
    collection   = 'KNOWLEDGE',
  } = options;

  const sources  = [];
  const contexts = [];

  // ── 1. Vector DB ───────────────────────────────────────
  if (useVector && isReady()) {
    try {
      const { results } = await semanticSearch(collection, query, topK);
      const relevant    = results.filter(r => r.score >= threshold);
      if (relevant.length) {
        log.memory(`Vector: ${relevant.length} chunks above threshold ${threshold}`);
        contexts.push('=== RETRIEVED KNOWLEDGE ===');
        relevant.forEach(r => {
          contexts.push(`[score:${r.score.toFixed(2)}] ${r.text}`);
          sources.push({ type: 'vector', score: r.score, source: r.metadata?.source });
        });
      }
    } catch (err) { log.warn('Vector retrieval failed', err.message); }
  }

  // ── 2. Knowledge Graph ─────────────────────────────────
  if (useKG) {
    try {
      const kgResult = queryGraph(query);
      if (kgResult?.content) {
        contexts.push('=== KNOWLEDGE GRAPH ===');
        contexts.push(kgResult.content);
        if (kgResult.neighbors?.length) {
          const related = kgResult.neighbors.slice(0, 3).map(n => `${n.edge.relation} → ${n.node.label}`).join(', ');
          contexts.push(`Related: ${related}`);
        }
        sources.push({ type: 'knowledge_graph', node: kgResult.node?.id });
      }
    } catch {}
  }

  // ── 3. Live web search ─────────────────────────────────
  let webResult = null;
  if (useWeb && process.env.TAVILY_API_KEY) {
    try {
      log.memory(`Web search: "${query.slice(0, 60)}"`);
      webResult = await webSearch(query, { maxResults: 3, searchDepth: 'advanced' });
      if (webResult.answer || webResult.results?.length) {
        contexts.push('=== WEB SEARCH ===');
        if (webResult.answer) contexts.push(`Summary: ${webResult.answer}`);
        webResult.results?.slice(0, 3).forEach(r => {
          contexts.push(`[${r.title}] ${r.content?.slice(0, 400)}`);
          sources.push({ type: 'web', url: r.url, title: r.title });
        });
      }
    } catch (err) { log.warn('Web retrieval failed', err.message); }
  }

  const hasContext      = contexts.length > 0;
  const contextText     = contexts.join('\n\n');
  const augmentedPrompt = hasContext
    ? `You have the following context to help answer the question:\n\n${contextText}\n\n---\nQuestion: ${query}\n\nAnswer based on the context and your knowledge:`
    : query;

  return {
    query,
    hasContext,
    contextText,
    augmentedPrompt,
    sources,
    webResult,
    contextLength: augmentedPrompt.length,
  };
}