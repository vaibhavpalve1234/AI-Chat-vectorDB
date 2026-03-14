// ============================================================
//  models/openai.js — OpenAI Adapter
// ============================================================
import OpenAI     from 'openai';
import { Config } from '../config/index.js';
import { log }    from '../shared/logger.js';

let _client = null;
const client = () => {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
};

export const OpenAIAdapter = {
  name: 'openai',

  async complete(prompt, options = {}) {
    const { system = '', temperature = Config.models.temperature, maxTokens = Config.models.maxTokens, responseFormat = null } = options;
    const start = Date.now();
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const params = { model: Config.models.openai, max_tokens: maxTokens, temperature, messages };
    if (responseFormat) params.response_format = responseFormat;

    log.model('OpenAI', `→ ${Config.models.openai} | ${prompt.length} chars`);
    const res = await client().chat.completions.create(params);

    return {
      text:       res.choices[0].message.content || '',
      model:      res.model,
      stopReason: res.choices[0].finish_reason,
      usage:      { input: res.usage.prompt_tokens, output: res.usage.completion_tokens },
      durationMs: Date.now() - start,
    };
  },

  async completeJson(prompt, options = {}) {
    const result = await this.complete(prompt, { ...options, responseFormat: { type: 'json_object' } });
    try { return { ...result, json: JSON.parse(result.text) }; }
    catch { return { ...result, json: null }; }
  },

  async chat(messages, options = {}) {
    const { temperature = Config.models.temperature } = options;
    const start = Date.now();
    log.model('OpenAI', `chat: ${messages.length} messages`);
    const res = await client().chat.completions.create({
      model: Config.models.openai, max_tokens: Config.models.maxTokens, temperature, messages,
    });
    return {
      text:       res.choices[0].message.content || '',
      model:      res.model,
      usage:      { input: res.usage.prompt_tokens, output: res.usage.completion_tokens },
      durationMs: Date.now() - start,
    };
  },

  async embed(input) {
    const isArr = Array.isArray(input);
    const res = await client().embeddings.create({
      model: 'text-embedding-3-small',
      input: isArr ? input : [input],
    });
    const vecs = res.data.map(d => d.embedding);
    return isArr ? vecs : vecs[0];
  },
};