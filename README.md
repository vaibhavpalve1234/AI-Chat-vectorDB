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
cp .env.example .env
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

Quick check:

- `GET /api/memory/stats` should show `vectorDB.ready: true`.
- By default, embeddings use `EMBEDDINGS_PROVIDER=openai`.
- If inserts fail with OpenAI quota/billing errors (HTTP 429), set `EMBEDDINGS_PROVIDER=ollama` and optionally `OLLAMA_EMBED_MODEL=nomic-embed-text` in `.env`.
- You can also run Chroma with Docker: `docker compose up -d chroma`.

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

Store a memory entry:

```bash
curl -X POST "http://localhost:3000/api/memory" \
  -H "Content-Type: application/json" \
  -d '{"content":"My favorite color is teal.","metadata":{"source":"manual-test"}}'
```

The response includes a `vector` status object (ready/attempted/saved/error) so you can tell if it actually wrote to the vector DB.

Strict mode (fail the request if vector insert fails):

```bash
curl -X POST "http://localhost:3000/api/memory?strict=true" \
  -H "Content-Type: application/json" \
  -d '{"content":"This must be stored in vectors.","metadata":{"source":"manual-test"}}'
```

---


## Multimodal Vector DB

Ingest and search **text, documents, images, videos, and GIF metadata/transcripts** into vector memory.

### Ingest one item

```bash
curl -X POST http://localhost:3000/api/vector/ingest \
-H "Content-Type: application/json" \
-d '{
  "item": {
    "modality": "image",
    "fileName": "chart.png",
    "caption": "Revenue chart for Q1",
    "tags": ["finance", "revenue"]
  }
}'
```

### Search multimodal memory

```bash
curl "http://localhost:3000/api/vector/search?q=revenue+chart&types=image,document&topK=5"
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
# 🤖 AI-OS

### Autonomous AI Operating System

[![Build](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/ai-os/ci.yml?style=for-the-badge)](https://github.com/YOUR_USERNAME/ai-os/actions)
[![License](https://img.shields.io/github/license/YOUR_USERNAME/ai-os?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/YOUR_USERNAME/ai-os?style=for-the-badge)](https://github.com/YOUR_USERNAME/ai-os/stargazers)
[![Issues](https://img.shields.io/github/issues/YOUR_USERNAME/ai-os?style=for-the-badge)](https://github.com/YOUR_USERNAME/ai-os/issues)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge)](https://nodejs.org)

AI-OS is a **multi-agent runtime platform** designed for autonomous AI workflows.

It provides:

* 🧠 Autonomous planning
* 🔌 Tool execution
* 🗂 Vector memory
* 📊 Analytics
* ⚡ Background tasks
* 🌐 REST + WebSocket APIs

---

# 📊 High-Level Architecture

```id="arch1"
                ┌───────────────┐
                │    Client     │
                │ CLI / API / UI│
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │   API Server  │
                │ Express + WS  │
                └───────┬───────┘
                        │
        ┌───────────────┼─────────────────┐
        ▼               ▼                 ▼
 ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
 │ Agent Kernel│ │   Task Queue │ │ Event Stream │
 │ Scheduler   │ │ Retry + Pri. │ │ WebSockets   │
 └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
        │               │                │
        ▼               ▼                ▼
 ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
 │   Agents    │ │    Tools    │ │   Memory    │
 │ research    │ │ web search  │ │ vector DB   │
 │ coding      │ │ code exec   │ │ KG store    │
 │ evaluation  │ │ filesystem  │ │ datasets    │
 └─────────────┘ └─────────────┘ └─────────────┘
```

---

# 🧠 Execution Flow

```id="arch2"
User Goal
   │
   ▼
Planner
   │
   ▼
Execution Plan
   │
   ▼
Executor
   │
   ├── Call Tools
   ├── Query Memory
   ├── Spawn Agents
   │
   ▼
Results
   │
   ▼
Evaluation Agent
   │
   ▼
Memory Storage
```

# ⚙️ Developer Setup

### 1️⃣ Clone repository

```bash id="dev1"
git clone https://github.com/YOUR_USERNAME/ai-os.git
cd ai-os
```

---

### 2️⃣ Install dependencies

```bash id="dev2"
npm install
```

---

### 3️⃣ Configure environment

```bash id="dev3"
cp .env.example .env
```

Fill in keys if needed.

---

### 4️⃣ Start the server

```bash id="dev4"
npm start
```

Server:

```
http://localhost:3000
```

---

# 🧠 Developer Documentation

## Agent Lifecycle

```id="devflow"
spawnAgent()
   │
   ▼
planner.createPlan()
   │
   ▼
executor.execute()
   │
   ▼
tool calls / memory
   │
   ▼
evaluationAgent.score()
   │
   ▼
memoryManager.save()
```

---

## Register a New Tool

```javascript
const { registerTool } = require("./tools");

registerTool("weather", async ({ city }) => {
  const data = await fetchWeather(city);
  return data;
});
```

---

## Create a New Agent

```javascript
class CustomAgent {
  async execute(input) {
    const result = await someTool(input);
    return result;
  }
}

module.exports = new CustomAgent();
```

---

# 🚀 Deployment

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

---

### Build Image

```bash id="docker1"
docker build -t ai-os .
```

---

### Run Container

```bash id="docker2"
docker run -p 3000:3000 ai-os
```

---

# ☸ Kubernetes Deployment

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-os
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-os
  template:
    metadata:
      labels:
        app: ai-os
    spec:
      containers:
        - name: ai-os
          image: ai-os:latest
          ports:
            - containerPort: 3000
```

---

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-os-service
spec:
  selector:
    app: ai-os
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

---

### Deploy

```bash id="kube1"
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

---

# 📊 Metrics Endpoint

```bash id="metrics"
curl http://localhost:3000/api/metrics
```

Returns:

```
task_count
agent_runtime
memory_usage
tool_calls
```

---

# 🔑 Environment Variables

| Variable          | Required |
| ----------------- | -------- |
| OPENAI_API_KEY    | optional |
| ANTHROPIC_API_KEY | optional |
| TAVILY_API_KEY    | optional |
| HF_API_KEY        | optional |

---

# 🛣 Roadmap

Future goals:

* distributed agent clusters
* reinforcement learning feedback
* autonomous tool discovery
* web dashboard UI
* plugin ecosystem

---

# 📜 License

MIT License

---

# 🌟 Vision

AI-OS aims to become a **runtime platform for autonomous AI systems**, enabling developers to build intelligent software capable of planning, reasoning, and executing tasks independently.
