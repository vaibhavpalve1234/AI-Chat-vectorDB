// ============================================================
//  models/ollama.js — Ollama Local Model Adapter
// ============================================================
import { Config } from '../config/index.js';
import { log }    from '../shared/logger.js';

export const OllamaAdapter = {
  name: 'ollama',

  async complete(prompt, options = {}) {
    const { system = '', temperature = Config.models.temperature } = options;
    const start  = Date.now();
    const model  = Config.models.ollama;
    const url    = `${Config.models.ollamaUrl}/api/generate`;

    log.model('Ollama', `→ ${model} @ ${Config.models.ollamaUrl}`);

    const body = { model, prompt: system ? `${system}\n\n${prompt}` : prompt, stream: false, options: { temperature } };

    try {
      const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = await res.json();

      return {
        text:       data.response || '',
        model,
        usage:      { input: data.prompt_eval_count || 0, output: data.eval_count || 0 },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      log.warn(`Ollama unreachable (${err.message}) — is it running?`);
      throw err;
    }
  },

  async chat(messages, options = {}) {
    const { temperature = Config.models.temperature } = options;
    const start = Date.now();
    const model = Config.models.ollama;
    const url   = `${Config.models.ollamaUrl}/api/chat`;

    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
    });
    if (!res.ok) throw new Error(`Ollama chat HTTP ${res.status}`);
    const data = await res.json();
    return { text: data.message?.content || '', model, durationMs: Date.now() - start };
  },

  async embed(input) {
    const { OpenAIAdapter } = await import('./openai.js');
    return OpenAIAdapter.embed(input);
  },
};