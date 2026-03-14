// ============================================================
//  tools/webSearch.js — Web Search Tool (Tavily)
// ============================================================
import { tavily }        from '@tavily/core';
import { registerTool }  from './index.js';
import { log }           from '../shared/logger.js';

let _tv = null;
const tv = () => {
  if (!_tv) {
    if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not set');
    _tv = tavily({ apiKey: process.env.TAVILY_API_KEY });
  }
  return _tv;
};

export async function webSearch(query, options = {}) {
  const { maxResults = 5, searchDepth = 'advanced', includeAnswer = true } = options;
  log.tool('webSearch', query.slice(0, 60));
  const res = await tv().search(query, { maxResults, searchDepth, includeAnswer });
  return {
    query,
    answer:  res.answer || null,
    results: (res.results || []).map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })),
  };
}

export async function webExtract(urls) {
  const res = await tv().extract(Array.isArray(urls) ? urls : [urls]);
  return { results: (res.results || []).map(r => ({ url: r.url, content: r.rawContent?.slice(0, 3000) })) };
}

registerTool({
  name: 'web_search',
  description: 'Search the web for current information, facts, news',
  schema: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
  execute: ({ query, maxResults }) => webSearch(query, { maxResults }),
});

registerTool({
  name: 'web_extract',
  description: 'Extract full text content from specific URLs',
  schema: { type: 'object', properties: { urls: { type: 'array', items: { type: 'string' } } }, required: ['urls'] },
  execute: ({ urls }) => webExtract(urls),
});