# 🤖 AI-OS

**Autonomous AI Operating System**

A **multi-model, multi-agent runtime** designed for building intelligent autonomous systems.
AI-OS provides a **production-ready backend** with:

* 🧠 Multi-agent orchestration
* 🔌 Tool integration
* 🗂 Vector memory + RAG
* ⚡ Task queue
* 🌐 REST API + WebSocket events
* 🧪 Evaluation & analytics

AI-OS can power **AI assistants, autonomous research agents, coding agents, and AI automation platforms**.

---

# 🚀 Features

| Feature             | Description                                      |
| ------------------- | ------------------------------------------------ |
| Multi-Agent System  | Research, coding, tool, and evaluation agents    |
| Multi-Model Support | OpenAI, Anthropic, HuggingFace, and local models |
| Tool Execution      | Web search, code sandbox, filesystem, HTTP APIs  |
| RAG Memory          | Vector search + knowledge graph                  |
| Autonomous Planning | Goal → plan → execution pipeline                 |
| Task Queue          | Background processing with retries               |
| WebSocket Events    | Real-time system events                          |
| Analytics           | Runtime metrics and monitoring                   |

---

# 🏗 Architecture

```
AI-OS
│
├── kernel/
│   ├── agentScheduler.js
│   ├── planner.js
│   ├── executor.js
│   └── memoryManager.js
│
├── models/
│   ├── index.js
│   ├── openai.js
│   ├── claude.js
│   ├── ollama.js
│   └── huggingface.js
│
├── tools/
│   ├── index.js
│   ├── webSearch.js
│   ├── codeExecutor.js
│   ├── fileSystem.js
│   └── apiCaller.js
│
├── memory/
│   ├── vectorDB.js
│   ├── knowledgeGraph.js
│   └── datasetStore.js
│
├── rag/
│   ├── embedder.js
│   └── retriever.js
│
├── queue/
│   └── taskQueue.js
│
├── dashboard/
│   └── analytics.js
│
├── agents/
│   ├── researchAgent.js
│   ├── codingAgent.js
│   ├── evaluationAgent.js
│   └── toolAgent.js
│
├── api/
│   └── server.js
│
├── shared/
│   ├── logger.js
│   ├── events.js
│   └── utils.js
│
└── config/
    └── index.js
```

---

# ⚡ Quick Start

### 1️⃣ Install dependencies

```bash
npm install
```

### 2️⃣ Configure environment

```bash
cp config/.env.example .env
```

Fill in your API keys.

### 3️⃣ Start server

```bash
npm start
```

Server starts on:

```
http://localhost:3000
```

---

# 🧠 Optional Components

### Vector Memory (ChromaDB)

Install Chroma:

```bash
pip install chromadb
```

Run:

```bash
chroma run --path ./data/chromadb
```

---

### Local LLM Support

AI-OS supports local models via **Ollama**.

Start Ollama:

```bash
ollama serve
```

Download model:

```bash
ollama pull llama3
```

---

# 🌐 REST API

## Run an autonomous goal

```bash
curl -X POST http://localhost:3000/api/run \
-H "Content-Type: application/json" \
-d '{"goal":"Research the latest AI papers and summarize key trends"}'
```

---

## Spawn an agent

### Research Agent

```bash
curl -X POST http://localhost:3000/api/agent \
-d '{"type":"research","input":"What is quantum computing?"}'
```

### Coding Agent

```bash
curl -X POST http://localhost:3000/api/agent \
-d '{"type":"coding","input":{"task":"Write a fibonacci function and test it"}}'
```

### Tool Agent

```bash
curl -X POST http://localhost:3000/api/agent \
-d '{"type":"tool","input":"Search for the current Bitcoin price"}'
```

---

# 🧠 Memory Search

Semantic vector search:

```bash
curl "http://localhost:3000/api/memory/search?q=machine+learning&topK=5"
```

---

# 🔧 Tool Execution

### Web Search

```bash
curl -X POST http://localhost:3000/api/tools/web_search \
-d '{"query":"Node.js best practices 2025"}'
```

### Execute Code

```bash
curl -X POST http://localhost:3000/api/tools/execute_code \
-d '{"code":"const arr=[3,1,2]; console.log(arr.sort())"}'
```

---

# ⚙️ Background Tasks

Queue a task:

```bash
curl -X POST http://localhost:3000/api/task \
-d '{"type":"research","payload":"Summarize recent ML papers","priority":2}'
```

---

# 🔌 WebSocket Events

Subscribe to system events:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = ({ data }) => {
  const { event, data: payload } = JSON.parse(data);
  console.log(event, payload);
};
```

Example events:

```
task:queued
task:completed
agent:done
memory:saved
tool:called
```

---

# 📊 Metrics

System runtime metrics:

```bash
curl http://localhost:3000/api/metrics
```

---

# 🔑 API Keys

| Key               | Required | Source                        |
| ----------------- | -------- | ----------------------------- |
| OPENAI_API_KEY    | Required | https://platform.openai.com   |
| ANTHROPIC_API_KEY | Optional | https://console.anthropic.com |
| TAVILY_API_KEY    | Optional | https://tavily.com            |
| HF_API_KEY        | Optional | https://huggingface.co        |

---

# 🧠 Supported Models

AI-OS can route requests across multiple models:

* OpenAI GPT
* Anthropic Claude
* HuggingFace models
* Local models via Ollama

---

# 📈 Roadmap

Future improvements:

* Multi-agent collaboration workflows
* AI planning graph engine
* Autonomous tool discovery
* Reinforcement learning feedback loops
* Distributed agent clusters
* Web dashboard UI

---

# 🤝 Contributing

Pull requests are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Submit PR

---

# 📜 License

MIT License

---

# 🌟 AI-OS Vision

AI-OS aims to become a **general-purpose runtime for autonomous AI systems**, enabling developers to build:

* AI research agents
* coding assistants
* automation platforms
* autonomous software systems
