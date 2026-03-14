"# AI-OS 🤖"

Autonomous AI Operating System — Multi-model, multi-agent, production-grade runtime with REST API + WebSocket event stream.


Architecture
AI-OS
│
├── kernel/
│   ├── agentScheduler.js   Spawns & tracks agents, enforces concurrency
│   ├── planner.js          LLM-powered goal → step decomposition
│   ├── executor.js         Runs plans with dependency ordering + replan
│   └── memoryManager.js    Unified interface over all memory backends
│
├── models/
│   ├── index.js            Model router (lazy-loads adapters)
│   ├── openai.js           OpenAI GPT-4o adapter + embeddings
│   ├── claude.js           Anthropic Claude adapter
│   ├── ollama.js           Ollama local model adapter
│   └── huggingface.js      HuggingFace Inference API adapter
│
├── tools/
│   ├── index.js            Tool registry (register, execute, list)
│   ├── webSearch.js        Tavily web search + extract
│   ├── codeExecutor.js     Safe JS sandbox (subprocess isolated)
│   ├── fileSystem.js       Sandboxed file I/O (data/workspace/)
│   └── apiCaller.js        Generic HTTP API caller
│
├── memory/
│   ├── vectorDB.js         ChromaDB multi-collection vector store
│   ├── knowledgeGraph.js   In-memory graph with JSON persistence
│   └── datasetStore.js     History, datasets, eval result storage
│
├── rag/
│   ├── embedder.js         Text chunker + embedding pipeline
│   └── retriever.js        Smart retrieval: vector → KG → web
│
├── queue/
│   └── taskQueue.js        Priority task queue (persistent, retry-aware)
│
├── dashboard/
│   └── analytics.js        Live metrics + terminal dashboard
│
├── agents/
│   ├── researchAgent.js    Research with web search + RAG synthesis
│   ├── codingAgent.js      Write → Execute → Fix code loop
│   ├── evaluationAgent.js  6-dimension LLM response scorer
│   └── toolAgent.js        Decides + calls tools to complete tasks
│
├── api/
│   └── server.js           Express REST + WebSocket API
│
├── shared/
│   ├── logger.js           Structured logger
│   ├── events.js           Global event bus (EventEmitter3)
│   └── utils.js            Common helpers
│
└── config/
    └── index.js            Central configuration

Quick Start
bashnpm install
cp config/.env.example .env    # fill in API keys
npm start                       # starts API on :3000
Optional — ChromaDB for vector memory:
bashpip install chromadb
chroma run --path ./data/chromadb
Optional — Ollama for local models:
bashollama serve
ollama pull llama3

API Usage
Run a goal (full plan + execution)
bashcurl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Research the latest AI papers and summarize key trends"}'
Spawn a specific agent
bashcurl -X POST http://localhost:3000/api/agent \
  -d '{"type": "research", "input": "What is quantum computing?"}'

curl -X POST http://localhost:3000/api/agent \
  -d '{"type": "coding",   "input": {"task": "Write a fibonacci function and test it"}}'

curl -X POST http://localhost:3000/api/agent \
  -d '{"type": "tool",     "input": "Search for the current Bitcoin price"}'
Queue a background task
bashcurl -X POST http://localhost:3000/api/task \
  -d '{"type": "research", "payload": "Summarize recent ML papers", "priority": 2}'
Semantic memory search
bashcurl "http://localhost:3000/api/memory/search?q=machine+learning&topK=5"
Execute a tool directly
bashcurl -X POST http://localhost:3000/api/tools/web_search \
  -d '{"query": "Node.js best practices 2025"}'

curl -X POST http://localhost:3000/api/tools/execute_code \
  -d '{"code": "const arr = [3,1,2]; console.log(arr.sort())"}'
WebSocket event stream
javascriptconst ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = ({ data }) => {
  const { event, data: payload } = JSON.parse(data);
  console.log(event, payload);
  // Events: task:queued, task:completed, agent:done, memory:saved, tool:called, ...
};
System metrics
bashcurl http://localhost:3000/api/metrics

API Keys
KeyRequiredSourceOPENAI_API_KEY✅platform.openai.comANTHROPIC_API_KEYOptionalconsole.anthropic.comTAVILY_API_KEYOptionaltavily.com — free tierHF_API_KEYOptionalhuggingface.co