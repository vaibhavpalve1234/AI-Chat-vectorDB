// ============================================================
//  tools/githubCrawler.js — GitHub Search/Crawler Tool
// ============================================================
import { registerTool } from './index.js';

const API = 'https://api.github.com';

export async function githubCrawler({ query, type = 'repositories', perPage = 5 }) {
  if (!query) throw new Error('query is required');
  const endpoint = type === 'code' ? 'search/code' : 'search/repositories';
  const url = `${API}/${endpoint}?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 10)}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`);
  const json = await res.json();

  return {
    query,
    type,
    total: json.total_count || 0,
    items: (json.items || []).slice(0, perPage).map((it) => ({
      name: it.full_name || it.name,
      url: it.html_url,
      description: it.description || '',
      stars: it.stargazers_count,
    })),
  };
}

registerTool({
  name: 'github_crawler',
  description: 'Search GitHub repositories or code by query',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      type: { type: 'string', enum: ['repositories', 'code'] },
      perPage: { type: 'number' },
    },
    required: ['query'],
  },
  execute: (params) => githubCrawler(params),
});
