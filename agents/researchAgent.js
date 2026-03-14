// ============================================================
//  agents/researchAgent.js — Research Agent
//  Plans searches → executes in parallel → synthesizes answer
// ============================================================
import { getModel }    from '../models/index.js';
import { retrieve }    from '../rag/retriever.js';
import { remember }    from '../kernel/memoryManager.js';
import { webSearch }   from '../tools/webSearch.js';
import { log }         from '../shared/logger.js';
import { safeJson, uuid, now } from '../shared/utils.js';
import { bus, Events } from '../shared/events.js';

const SYSTEM = `You are a research synthesizer. Given search results and context, 
produce a comprehensive, accurate, well-cited answer. Be concise but complete.`;

export async function run(input, options = {}) {
  const { agentId = uuid() } = options;
  const start = Date.now();
  log.agent('ResearchAgent', `Starting: "${String(input).slice(0, 70)}"`);
  bus.emit(Events.AGENT_LOG, { agentId, message: 'Research started', input });

  const query  = typeof input === 'object' ? input.query || input.goal : input;
  const useWeb = options.useWeb ?? !!process.env.TAVILY_API_KEY;

  // 1. Retrieve from memory + optional web
  const retrieval = await retrieve(query, { useWeb, useVector: true, useKG: true });

  // 2. If web enabled, plan extra targeted queries
  let extraContext = '';
  if (useWeb && process.env.TAVILY_API_KEY) {
    const model = await getModel(options.model || 'openai');
    const planPrompt = `Generate 2 targeted search queries to research: "${query}"\nReturn JSON array of strings only.`;
    const planRes    = await model.complete(planPrompt, { temperature: 0.3 });
    const queries    = safeJson(planRes.text) || [query];

    const results = await Promise.allSettled(
      queries.slice(0, 2).map(q => webSearch(q, { maxResults: 3 }))
    );
    const webSnippets = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.results?.map(x => `[${x.title}] ${x.content}`) || []);
    extraContext = webSnippets.join('\n\n').slice(0, 4000);
  }

  // 3. Synthesize
  const model  = await getModel(options.model || 'openai');
  const prompt = retrieval.hasContext || extraContext
    ? `${retrieval.augmentedPrompt}\n\n${extraContext ? 'Additional web context:\n' + extraContext : ''}`
    : query;

  const response = await model.complete(prompt, { system: SYSTEM, temperature: 0.5 });

  // 4. Store result in memory
  await remember(response.text, { source: 'research', query, agentId }).catch(() => {});

  const result = {
    agentId,
    type:       'research',
    query,
    answer:     response.text,
    sources:    retrieval.sources,
    model:      response.model,
    usage:      response.usage,
    durationMs: Date.now() - start,
    timestamp:  now(),
  };

  bus.emit(Events.AGENT_LOG, { agentId, message: 'Research complete', durationMs: result.durationMs });
  log.agent('ResearchAgent', `Done in ${result.durationMs}ms`);
  return result;
}