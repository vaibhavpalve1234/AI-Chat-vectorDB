// ============================================================
//  agents/evaluationAgent.js — Evaluation Agent
//  Scores responses on multiple dimensions using LLM judge
// ============================================================
import { getModel }  from '../models/index.js';
import { saveEval }  from '../memory/datasetStore.js';
import { log }       from '../shared/logger.js';
import { safeJson, uuid, now, average } from '../shared/utils.js';

const RUBRIC = {
  accuracy:     { weight: 0.25, desc: 'Factual correctness' },
  completeness: { weight: 0.20, desc: 'How fully the question is answered' },
  helpfulness:  { weight: 0.20, desc: 'Practical value' },
  reasoning:    { weight: 0.15, desc: 'Quality of logic' },
  conciseness:  { weight: 0.10, desc: 'Appropriate brevity' },
  groundedness: { weight: 0.10, desc: 'Evidence-based' },
};

const JUDGE_SYSTEM = `You are an objective AI response evaluator. 
Score each dimension 0-10 strictly. Return ONLY valid JSON.`;

export async function run(input, options = {}) {
  const { agentId = uuid() } = options;
  const start = Date.now();
  const { question, response, reference = '', model: modelName = 'openai' } = 
    typeof input === 'object' ? input : { question: input, response: input };

  log.agent('EvaluationAgent', `Evaluating response for: "${String(question).slice(0, 60)}"`);

  const model  = await getModel(modelName);
  const prompt = `Question: "${question}"
${reference ? `Reference: "${reference}"` : ''}
Response: "${String(response).slice(0, 2000)}"

Score this response on each dimension (0-10). Return JSON:
{
  "accuracy":     { "score": 0-10, "reason": "..." },
  "completeness": { "score": 0-10, "reason": "..." },
  "helpfulness":  { "score": 0-10, "reason": "..." },
  "reasoning":    { "score": 0-10, "reason": "..." },
  "conciseness":  { "score": 0-10, "reason": "..." },
  "groundedness": { "score": 0-10, "reason": "..." },
  "strengths":    ["..."],
  "weaknesses":   ["..."]
}`;

  let scores = null;
  let weighted = 0;

  try {
    const res  = await model.complete(prompt, { system: JUDGE_SYSTEM, temperature: 0.2 });
    scores = safeJson(res.text);
    if (scores) {
      for (const [dim, rubric] of Object.entries(RUBRIC)) {
        weighted += (scores[dim]?.score ?? 0) * rubric.weight;
      }
    }
  } catch (err) { log.warn('Evaluation scoring failed', err.message); }

  const result = {
    agentId,
    type:           'evaluation',
    question,
    response:       String(response).slice(0, 500),
    scores,
    weightedScore:  parseFloat(weighted.toFixed(2)),
    grade:          toGrade(weighted),
    durationMs:     Date.now() - start,
    timestamp:      now(),
  };

  saveEval('agent_evals', result);
  log.agent('EvaluationAgent', `Score: ${result.weightedScore}/10 (${result.grade})`);
  return result;
}

function toGrade(s) {
  if (s >= 9) return 'A+'; if (s >= 8) return 'A';
  if (s >= 7) return 'B';  if (s >= 6) return 'C';
  if (s >= 5) return 'D';  return 'F';
}