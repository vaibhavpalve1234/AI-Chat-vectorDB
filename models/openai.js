// ============================================================
// models/openai.js — OpenAI Adapter
// ============================================================

import OpenAI from "openai";
import { Config } from "../config/index.js";
import { log } from "../shared/logger.js";

let _client = null;

/**
 * Create or reuse OpenAI client
 */
function client() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1'
    });
  }
  return _client;
}

export const OpenAIAdapter = {
  name: "openai",

  // ==========================================================
  // Text Completion
  // ==========================================================
  async complete(prompt, options = {}) {
    const {
      system = "",
      temperature = Config.models.temperature,
      maxTokens = Config.models.maxTokens,
      responseFormat = null,
    } = options;

    const start = Date.now();

    const messages = [];

    if (system) {
      messages.push({
        role: "system",
        content: system,
      });
    }

    messages.push({
      role: "user",
      content: prompt,
    });

    const params = {
      model: Config.models.openai,
      max_tokens: maxTokens,
      temperature,
      messages,
    };

    if (responseFormat) {
      params.response_format = responseFormat;
    }

    log.model("OpenAI", `→ ${Config.models.openai} | ${prompt.length} chars`);

    const res = await client().chat.completions.create(params);

    return {
      text: res.choices?.[0]?.message?.content || "",
      model: res.model,
      stopReason: res.choices?.[0]?.finish_reason || "stop",
      usage: {
        input: res.usage?.prompt_tokens || 0,
        output: res.usage?.completion_tokens || 0,
      },
      durationMs: Date.now() - start,
    };
  },

  // ==========================================================
  // JSON Completion
  // ==========================================================
  async completeJson(prompt, options = {}) {
    const result = await this.complete(prompt, {
      ...options,
      responseFormat: { type: "json_object" },
    });

    try {
      return {
        ...result,
        json: JSON.parse(result.text),
      };
    } catch {
      return {
        ...result,
        json: null,
      };
    }
  },

  // ==========================================================
  // Chat Interface
  // ==========================================================
  async chat(messages, options = {}) {
    const { temperature = Config.models.temperature } = options;
    const start = Date.now();

    log.model("OpenAI", `chat: ${messages.length} messages`);

    const res = await client().chat.completions.create({
      model: Config.models.openai,
      max_tokens: Config.models.maxTokens,
      temperature,
      messages,
    });

    return {
      text: res.choices?.[0]?.message?.content || "",
      model: res.model,
      usage: {
        input: res.usage?.prompt_tokens || 0,
        output: res.usage?.completion_tokens || 0,
      },
      durationMs: Date.now() - start,
    };
  },

  // ==========================================================
  // Embeddings (for VectorDB like Chroma)
  // ==========================================================
  async embed(input) {
    const isArray = Array.isArray(input);

    const res = await client().embeddings.create({
      model: "text-embedding-3-small",
      input: isArray ? input : [input],
    });

    const vectors = res.data.map((d) => d.embedding);

    return isArray ? vectors : vectors[0];
  },
};