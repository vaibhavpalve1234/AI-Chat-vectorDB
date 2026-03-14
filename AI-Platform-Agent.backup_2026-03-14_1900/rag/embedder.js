// ============================================================
//  rag/embedder.js — Text Embedder + Chunker
// ============================================================
import { getModel }   from '../models/index.js';
import { addDocuments, COLLECTIONS } from '../memory/vectorDB.js';
import { log }        from '../shared/logger.js';
import { uuid }       from '../shared/utils.js';

const DEFAULT_CHUNK_SIZE    = 512;   // characters
const DEFAULT_CHUNK_OVERLAP = 64;

/**
 * Chunk text into overlapping windows.
 */
export function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
    if (i + overlap >= text.length) break;
  }
  if (i < text.length) chunks.push(text.slice(i));
  return chunks;
}

/**
 * Embed text and store in the vector DB.
 * @param {string} text - Full text to index
 * @param {object} metadata - Metadata to attach to each chunk
 * @param {string} collection - Which ChromaDB collection to store in
 */
export async function embedAndStore(text, metadata = {}, collection = 'KNOWLEDGE') {
  const chunks = chunkText(text);
  log.memory(`Embedding ${chunks.length} chunks → ${collection}`);

  const docs = chunks.map((chunk, i) => ({
    id:       `${uuid()}_c${i}`,
    text:     chunk,
    metadata: { ...metadata, chunkIndex: i, totalChunks: chunks.length },
  }));

  await addDocuments(collection, docs);
  return { chunks: docs.length, collection };
}

/**
 * Embed a single string and return the vector.
 */
export async function embedText(text) {
  const model = await getModel('openai');
  return model.embed(text);
}

/**
 * Embed multiple strings in batch.
 */
export async function embedBatch(texts) {
  const model = await getModel('openai');
  return model.embed(texts);
}

/**
 * Ingest a document from URL, file content, or raw text.
 */
export async function ingestDocument({ type, content, source, metadata = {} }) {
  const base = { source: source || 'unknown', type, ...metadata };

  if (type === 'text' || type === 'markdown') {
    return embedAndStore(content, base);
  }

  if (type === 'json') {
    const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    return embedAndStore(text, base);
  }

  if (type === 'url') {
    // Fetch and embed
    const res  = await fetch(content);
    const text = await res.text();
    return embedAndStore(text.slice(0, 50_000), { ...base, url: content });
  }

  throw new Error(`Unsupported document type: "${type}"`);
}