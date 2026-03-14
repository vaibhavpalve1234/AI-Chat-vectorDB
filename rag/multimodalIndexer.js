// ============================================================
//  rag/multimodalIndexer.js — Multimodal Vector Ingest + Search
//  Supports: text, document, image, video, gif
// ============================================================
import { addDocuments, semanticSearch, COLLECTIONS, isReady } from '../memory/vectorDB.js';
import { chunkText } from './embedder.js';
import { uuid, now } from '../shared/utils.js';

const MODALITIES = ['text', 'document', 'image', 'video', 'gif'];

export function listModalities() {
  return [...MODALITIES];
}

export function normalizeModality(raw = '') {
  const m = String(raw || '').toLowerCase();
  if (MODALITIES.includes(m)) return m;
  if (['doc', 'pdf', 'md', 'markdown'].includes(m)) return 'document';
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(m)) return 'image';
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(m)) return 'video';
  return 'text';
}

export async function ingestMultimodalItem(item, options = {}) {
  const source = normalizeItem(item);
  const collection = options.collection || 'MEDIA';
  const chunkSize = options.chunkSize || 700;
  const overlap = options.overlap || 120;

  const vectorText = buildVectorText(source).trim();
  if (!vectorText) throw new Error('No vectorizable content found in item');

  const chunks = chunkText(vectorText, chunkSize, overlap);
  const docs = chunks.map((text, i) => ({
    id: `${source.id}_c${i}`,
    text,
    metadata: {
      modality: source.modality,
      sourceType: source.sourceType,
      fileName: source.fileName || null,
      url: source.url || null,
      mimeType: source.mimeType || null,
      tags: (source.tags || []).join(','),
      createdAt: now(),
      itemId: source.id,
      chunkIndex: i,
      totalChunks: chunks.length,
      ...(source.metadata || {}),
    },
  }));

  const vectorReady = isReady();
  await addDocuments(collection, docs);

  return {
    id: source.id,
    modality: source.modality,
    chunks: docs.length,
    collection,
    vectorReady,
    indexed: vectorReady,
  };
}

export async function ingestMultimodalBatch(items = [], options = {}) {
  const results = await Promise.allSettled(items.map((it) => ingestMultimodalItem(it, options)));
  return {
    total: items.length,
    ok: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    results: results.map((r, i) => ({
      index: i,
      status: r.status,
      value: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason?.message : null,
    })),
  };
}

export async function searchMultimodal(query, options = {}) {
  const topK = parseInt(options.topK || 8);
  const collection = options.collection || 'MEDIA';
  const types = (options.types || []).map(normalizeModality);

  if (!types.length) {
    return semanticSearch(collection, query, topK);
  }

  const each = Math.max(2, Math.ceil(topK / types.length));
  const searches = await Promise.all(
    types.map((modality) => semanticSearch(collection, query, each, { modality }))
  );

  const merged = searches
    .flatMap((s) => s.results || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { available: searches.some((s) => s.available), results: merged };
}

function normalizeItem(item = {}) {
  if (!item || typeof item !== 'object') throw new Error('Item must be an object');

  const id = item.id || uuid();
  const modality = normalizeModality(item.modality || item.type || item.mediaType || inferFromName(item.fileName || item.url));

  return {
    id,
    modality,
    sourceType: item.sourceType || 'manual',
    text: item.text || item.content || '',
    title: item.title || '',
    caption: item.caption || '',
    transcript: item.transcript || '',
    ocrText: item.ocrText || '',
    altText: item.altText || '',
    description: item.description || '',
    fileName: item.fileName || '',
    url: item.url || '',
    mimeType: item.mimeType || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    metadata: item.metadata || {},
  };
}

function inferFromName(name = '') {
  const n = String(name).toLowerCase();
  if (!n) return 'text';
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(n)) return n.endsWith('.gif') ? 'gif' : 'image';
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(n)) return 'video';
  if (/\.(pdf|doc|docx|ppt|pptx|txt|md)$/.test(n)) return 'document';
  return 'text';
}

function buildVectorText(src) {
  const lines = [
    `modality: ${src.modality}`,
    src.title ? `title: ${src.title}` : '',
    src.description ? `description: ${src.description}` : '',
    src.caption ? `caption: ${src.caption}` : '',
    src.altText ? `alt_text: ${src.altText}` : '',
    src.ocrText ? `ocr_text: ${src.ocrText}` : '',
    src.transcript ? `transcript: ${src.transcript}` : '',
    src.text ? `content: ${src.text}` : '',
    src.tags?.length ? `tags: ${src.tags.join(', ')}` : '',
    src.fileName ? `filename: ${src.fileName}` : '',
    src.url ? `url: ${src.url}` : '',
  ].filter(Boolean);

  if (!lines.length) return '';
  return lines.join('\n');
}

export { COLLECTIONS };
