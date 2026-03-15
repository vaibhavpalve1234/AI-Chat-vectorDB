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
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
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
    const isArr = Array.isArray(input);
    const texts = isArr ? input : [input];

    // Ollama embeddings endpoint expects a single prompt per request.
    // Use OLLAMA_EMBED_MODEL if provided; otherwise reuse the chat model name.
    const model = Config.models.ollamaEmbed || Config.models.ollama;
    const url   = `${Config.models.ollamaUrl}/api/embeddings`;

    const vecs = [];
    for (const prompt of texts) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt }),
      });
      if (!res.ok) throw new Error(`Ollama embeddings HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      vecs.push(data.embedding);
    }

    return isArr ? vecs : vecs[0];
  },
};
