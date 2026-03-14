// ============================================================
//  models/claude.js — Anthropic Claude Adapter
// ============================================================
import Anthropic  from '@anthropic-ai/sdk';
import { Config } from '../config/index.js';
import { log }    from '../shared/logger.js';

let _client = null;
const client = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};

export const ClaudeAdapter = {
  name: 'claude',

  async complete(prompt, options = {}) {
    const { system = '', temperature = Config.models.temperature, maxTokens = Config.models.maxTokens } = options;
    const start = Date.now();
    log.model('Claude', `→ ${Config.models.claude} | ${prompt.length} chars`);

    const params = {
      model: Config.models.claude, max_tokens: maxTokens, temperature,
      messages: [{ role: 'user', content: prompt }],
    };
    if (system) params.system = system;

    const res  = await client().messages.create(params);
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');

    return {
      text,
      model:      res.model,
      stopReason: res.stop_reason,
      usage:      { input: res.usage.input_tokens, output: res.usage.output_tokens },
      durationMs: Date.now() - start,
    };
  },

  async chat(messages, options = {}) {
    const { system = '', temperature = Config.models.temperature } = options;
    const start = Date.now();
    log.model('Claude', `chat: ${messages.length} messages`);
    const params = {
      model: Config.models.claude, max_tokens: Config.models.maxTokens, temperature, messages,
    };
    if (system) params.system = system;
    const res  = await client().messages.create(params);
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return {
      text, model: res.model,
      usage:      { input: res.usage.input_tokens, output: res.usage.output_tokens },
      durationMs: Date.now() - start,
    };
  },

  // Claude doesn't have native embeddings — delegate to OpenAI
  async embed(input) {
    const { OpenAIAdapter } = await import('./openai.js');
    return OpenAIAdapter.embed(input);
  },
};