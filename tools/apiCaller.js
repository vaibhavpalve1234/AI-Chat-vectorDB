// ============================================================
//  tools/apiCaller.js — Generic HTTP API Caller Tool
// ============================================================
import { registerTool } from './index.js';
import { log }          from '../shared/logger.js';

const TIMEOUT_MS     = 15_000;
const BLOCKED_HOSTS  = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

export async function callApi({ url, method = 'GET', headers = {}, body = null, timeout = TIMEOUT_MS }) {
  // Block internal network calls
  const host = new URL(url).hostname;
  if (BLOCKED_HOSTS.includes(host)) throw new Error(`Blocked: cannot call internal host "${host}"`);

  log.tool('apiCaller', `${method} ${url.slice(0, 80)}`);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);

  try {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers }, signal: controller.signal };
    if (body && method !== 'GET') opts.body = typeof body === 'string' ? body : JSON.stringify(body);

    const res  = await fetch(url, opts);
    const text = await res.text();

    let json = null;
    try { json = JSON.parse(text); } catch {}

    return {
      status:  res.status,
      ok:      res.ok,
      headers: Object.fromEntries(res.headers.entries()),
      body:    text.slice(0, 4096),
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

registerTool({
  name: 'api_call',
  description: 'Make an HTTP request to any external API and return the response',
  schema: {
    type: 'object',
    properties: {
      url:     { type: 'string', description: 'Full URL to call' },
      method:  { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE' },
      headers: { type: 'object', description: 'Request headers' },
      body:    { description: 'Request body (for POST/PUT)' },
    },
    required: ['url'],
  },
  execute: (params) => callApi(params),
});