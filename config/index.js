// ============================================================
//  config/index.js — Central Configuration
// ============================================================
import 'dotenv/config';

export const Config = {
  // Models
  models: {
    default:        process.env.DEFAULT_MODEL     || 'openai',
    openai:         process.env.OPENAI_MODEL      || 'gpt-4o',
    claude:         process.env.CLAUDE_MODEL      || 'claude-sonnet-4-6',
    ollama:         process.env.OLLAMA_MODEL      || 'llama3',
    ollamaUrl:      process.env.OLLAMA_URL        || 'http://localhost:11434',
    huggingfaceUrl: process.env.HF_INFERENCE_URL  || 'https://api-inference.huggingface.co',
    maxTokens:      parseInt(process.env.MAX_TOKENS) || 2000,
    temperature:    parseFloat(process.env.TEMPERATURE) || 0.7,
  },

  // Memory
  memory: {
    chromaUrl:    process.env.CHROMA_URL        || 'http://localhost:8000',
    cacheHit:     parseFloat(process.env.CACHE_HIT  || '0.85'),
    cacheSoft:    parseFloat(process.env.CACHE_SOFT || '0.72'),
    cacheAgeDays: parseInt(process.env.CACHE_AGE_DAYS || '30'),
    maxHistory:   parseInt(process.env.MAX_HISTORY   || '500'),
  },

  // Queue
  queue: {
    concurrency:  parseInt(process.env.QUEUE_CONCURRENCY || '5'),
    maxRetries:   parseInt(process.env.MAX_RETRIES       || '3'),
    timeoutMs:    parseInt(process.env.TASK_TIMEOUT_MS   || '60000'),
    pollInterval: parseInt(process.env.QUEUE_POLL_MS     || '500'),
  },

  // API
  api: {
    port:      parseInt(process.env.PORT       || '3000'),
    host:      process.env.HOST               || '0.0.0.0',
    wsEnabled: process.env.WS_ENABLED         !== 'false',
    corsOrigin: process.env.CORS_ORIGIN       || '*',
  },

  // Tools
  tools: {
    tavilyKey:    process.env.TAVILY_API_KEY   || '',
    execTimeoutMs: parseInt(process.env.EXEC_TIMEOUT_MS || '5000'),
    maxOutputBytes: parseInt(process.env.MAX_OUTPUT_BYTES || '4096'),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};