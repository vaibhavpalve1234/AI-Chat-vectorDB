// ============================================================
//  tools/browserAutomation.js — Lightweight browser automation
// ============================================================
import { registerTool } from './index.js';

export async function browserAutomation({ url, action = 'snapshot' }) {
  if (!url) throw new Error('url is required');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'AI-OS-BrowserAutomation/1.0' },
  });

  const html = await res.text();
  return {
    url,
    action,
    status: res.status,
    title: (html.match(/<title>(.*?)<\/title>/i)?.[1] || '').trim(),
    textPreview: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
  };
}

registerTool({
  name: 'browser_automation',
  description: 'Fetch a page and return extracted preview/title',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      action: { type: 'string', enum: ['snapshot'] },
    },
    required: ['url'],
  },
  execute: (params) => browserAutomation(params),
});
