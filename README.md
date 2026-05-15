# LightRAG — FinOps-Optimized GraphRAG Engine

> **GraphRAG at 1/6000th the cost of Microsoft's implementation**
> LightRAG + Gemini 2.5 Flash + NanoVectorDB · No external database · Fully portable

![Stack](https://img.shields.io/badge/Stack-LightRAG%20%7C%20Gemini%202.5%20Flash%20%7C%20FastAPI%20%7C%20React-blueviolet)
![Deploy](https://img.shields.io/badge/Deploy-AWS%20EC2%20t3.micro-orange)
![Cost](https://img.shields.io/badge/API%20Cost-Free%20(Gemini%20Free%20Tier)-green)

---

## What This Does

Drop in any plain-text document. LightRAG reads it, extracts all **named entities** and the **relationships** between them using Gemini 2.5 Flash, stores everything as a **knowledge graph** (GraphML) and **vector indexes** (NanoVectorDB) — all on local disk, no external database needed.

Query in **five modes** that go far beyond standard RAG:

| Mode | Strategy | Best For |
|------|----------|----------|
| `naive` | Vector search only | Baseline / simple lookups |
| `local` | Entity + graph neighbors | Specific people/places/concepts |
| `global` | Community summaries | Document themes, overview |
| `hybrid` | Local + global | Detail AND big-picture |
| `mix` | Everything merged | Unknown query type (recommended) |

---

## Stack

| Component | Technology |
|-----------|-----------|
| Knowledge Graph | LightRAG (GraphML via NetworkX) |
| LLM (extraction + synthesis) | Gemini 2.5 Flash |
| Embeddings | Gemini Embedding-001 (3072-dim) |
| Vector Store | NanoVectorDB (local JSON) |
| API Backend | FastAPI + Uvicorn |
| Frontend | React + Vite |
| Deployment | AWS EC2 t3.micro + Docker + Nginx |

---

## Quick Start (Local)

### Prerequisites
- Python 3.10+
- Node.js 18+
- `uv` (or `pip`)
- Free Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/lightrag-project.git
cd lightrag-project

# Python dependencies
uv venv && source .venv/bin/activate
uv pip install -r pyproject.toml

# or with pip:
pip install lightrag-hku==1.4.15 google-genai python-dotenv fastapi "uvicorn[standard]" python-multipart openai
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Start the Backend

```bash
PYTHONPATH=. uvicorn src.server:app --reload --port 8000
```

### 4. Start the Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 5. Ingest Sample Data

```bash
# Via CLI
PYTHONPATH=. python src/ingest.py data/sample.txt

# Or via the web UI → Ingest tab
```

### 6. Query!

```bash
# Via CLI
PYTHONPATH=. python src/query.py "What is the relationship between Mumbai and the Indian economy?" mix

# Or via the web UI → Query tab
```

---

## Production Build (Frontend + Backend together)

```bash
# Build React app
cd frontend && npm run build && cd ..

# The FastAPI server now serves the frontend at /
PYTHONPATH=. uvicorn src.server:app --host 0.0.0.0 --port 8000
# Visit http://localhost:8000
```

---

## Docker

```bash
cp .env.example .env   # fill in GEMINI_API_KEY
docker-compose up --build
# Visit http://localhost:8000
```

---

## AWS Deployment

See [`infra/AWS_DEPLOY.md`](infra/AWS_DEPLOY.md) for the full step-by-step guide.

**TL;DR:**
1. Launch EC2 t3.micro, open ports 22 and 80
2. `scp` the project to the instance
3. Run `sudo bash infra/ec2-bootstrap.sh`
4. Done — app running behind Nginx at `http://YOUR_EC2_IP`

---

## Project Structure

```
lightrag-project/
├── src/
│   ├── tokenizer.py       ← Custom UTF-8 tokenizer (no tiktoken network calls)
│   ├── rag_engine.py      ← LightRAG + Gemini assembly
│   ├── ingest.py          ← Single-file ingestion CLI
│   ├── ingest_folder.py   ← Batch folder ingestion
│   ├── query.py           ← Query CLI
│   └── server.py          ← FastAPI server (all endpoints)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← Main React app (query, ingest, stats tabs)
│   │   ├── App.css        ← Dark industrial UI styles
│   │   └── main.jsx       ← Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/                  ← Put your .txt files here
├── rag_storage/           ← LightRAG writes its graph here (auto-created)
├── infra/
│   ├── ec2-bootstrap.sh   ← EC2 user-data / setup script
│   └── AWS_DEPLOY.md      ← Full deployment guide
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
├── .env.example
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ingest` | Upload & ingest a .txt file |
| `POST` | `/api/ingest-text` | Ingest raw text directly |
| `POST` | `/api/query` | Query the knowledge graph |
| `GET`  | `/api/graph-stats` | Nodes, edges, chunks, file size |
| `GET`  | `/api/modes` | List query modes with descriptions |
| `GET`  | `/api/ingested-files` | List all ingested documents |
| `GET`  | `/api/health` | Health check |

### Example Query

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the main economic institutions?", "mode": "mix"}'
```

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: src` | Prefix commands with `PYTHONPATH=.` |
| `Vector count mismatch` | Ensure `embedding_dim=3072` and use `gemini_embed.func` |
| `403 on tiktoken download` | The custom tokenizer in `src/tokenizer.py` fixes this |
| `GEMINI_API_KEY not found` | Check `.env` is in project root; `load_dotenv()` runs first |
| `429 rate limit` | Reduce concurrency: `llm_model_max_async=2` in `build_rag()` |
| `Both GOOGLE_API_KEY and GEMINI_API_KEY set` | Run `unset GOOGLE_API_KEY` |

---

## Cost Comparison

| System | Cost per document |
|--------|------------------|
| Microsoft GraphRAG | ~$10–$30 |
| **LightRAG (this project)** | **~$0.002** |

> 6000x cheaper. Same graph-based retrieval quality.
