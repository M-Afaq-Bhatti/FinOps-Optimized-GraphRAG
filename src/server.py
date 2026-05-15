"""
LightRAG FastAPI Server
-----------------------
Endpoints:
  POST /api/ingest          - Upload & ingest a .txt file
  POST /api/ingest-folder   - Ingest all .txt files from the data/ folder
  POST /api/query           - Query the knowledge graph
  GET  /api/health          - Health check
  GET  /api/graph-stats     - Basic stats about the knowledge graph
  GET  /api/modes           - List valid query modes
"""

import os
import json
import time
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from lightrag import QueryParam

from src.rag_engine import build_rag, VALID_MODES

# ── Global RAG instance (loaded once at startup) ──────────────────────────────
rag_instance = None
ingestion_status = {"running": False, "last_file": None, "last_time": None, "error": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_instance
    print("[server] Initializing LightRAG…")
    rag_instance = build_rag()
    await rag_instance.initialize_storages()
    print("[server] LightRAG ready.")
    yield
    print("[server] Shutting down — flushing storages…")
    await rag_instance.finalize_storages()


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="LightRAG GraphRAG API",
    description="Knowledge Graph RAG powered by LightRAG + Gemini 2.5 Flash",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
DATA_DIR.mkdir(exist_ok=True)


# ── Pydantic models ────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    mode: str = Field(default="mix")


class QueryResponse(BaseModel):
    answer: str
    mode: str
    question: str
    elapsed_ms: int


class IngestResponse(BaseModel):
    status: str
    file: str
    chars: int
    words: int


class GraphStats(BaseModel):
    nodes: int
    edges: int
    chunks: int
    graph_file_size_kb: float


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "gemini-2.5-flash", "rag": "LightRAG"}


@app.get("/api/modes")
async def get_modes():
    descriptions = {
        "naive": "Pure vector search — identical to standard RAG. Use as a baseline.",
        "local": "Entity + immediate graph neighbors. Best for specific people/places/concepts.",
        "global": "High-level community summaries. Best for broad 'what is this about?' questions.",
        "hybrid": "Local entity traversal + global summaries. Detail + big-picture.",
        "mix": "Hybrid + vector chunk retrieval merged. Best default for unknown queries.",
    }
    return {"modes": [{"name": m, "description": descriptions[m]} for m in VALID_MODES]}


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest_file(file: UploadFile = File(...)):
    """Upload a .txt file and ingest it into the knowledge graph."""
    global ingestion_status

    if not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are supported.")

    if ingestion_status["running"]:
        raise HTTPException(status_code=409, detail="Ingestion already in progress.")

    # Save uploaded file
    dest = DATA_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    text = dest.read_text(encoding="utf-8")
    char_count = len(text)
    word_count = len(text.split())

    if word_count < 10:
        raise HTTPException(status_code=422, detail="File too short — needs at least 10 words.")

    ingestion_status = {"running": True, "last_file": file.filename, "last_time": None, "error": None}
    try:
        await rag_instance.ainsert(text, file_paths=str(dest))
        await rag_instance.finalize_storages()
        ingestion_status["running"] = False
        ingestion_status["last_time"] = time.time()
    except Exception as e:
        ingestion_status["running"] = False
        ingestion_status["error"] = str(e)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return IngestResponse(
        status="ingested",
        file=file.filename,
        chars=char_count,
        words=word_count,
    )


@app.post("/api/ingest-text")
async def ingest_raw_text(payload: dict):
    """Ingest raw text directly (no file upload needed)."""
    text = payload.get("text", "").strip()
    label = payload.get("label", "direct_input.txt")

    if len(text.split()) < 10:
        raise HTTPException(status_code=422, detail="Text too short — needs at least 10 words.")

    if ingestion_status["running"]:
        raise HTTPException(status_code=409, detail="Ingestion already in progress.")

    # Save to data dir for reference
    dest = DATA_DIR / label
    dest.write_text(text, encoding="utf-8")

    try:
        await rag_instance.ainsert(text, file_paths=str(dest))
        await rag_instance.finalize_storages()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return {"status": "ingested", "label": label, "chars": len(text), "words": len(text.split())}


@app.post("/api/query", response_model=QueryResponse)
async def query_rag(req: QueryRequest):
    """Query the knowledge graph."""
    if req.mode not in VALID_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{req.mode}'. Choose from: {', '.join(VALID_MODES)}",
        )

    start = time.time()
    try:
        result = await rag_instance.aquery(
            req.question,
            param=QueryParam(mode=req.mode),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")

    elapsed_ms = int((time.time() - start) * 1000)

    return QueryResponse(
        answer=result or "No answer found. Try ingesting more documents first.",
        mode=req.mode,
        question=req.question,
        elapsed_ms=elapsed_ms,
    )


@app.get("/api/graph-stats", response_model=GraphStats)
async def graph_stats():
    """Return basic statistics about the knowledge graph."""
    rag_storage = Path(os.getenv("RAG_STORAGE_DIR", "rag_storage"))

    graph_file = rag_storage / "graph_chunk_entity_relation.graphml"
    entities_file = rag_storage / "vdb_entities.json"
    chunks_file = rag_storage / "vdb_chunks.json"

    nodes, edges, chunks = 0, 0, 0
    graph_size_kb = 0.0

    if graph_file.exists():
        content = graph_file.read_text(encoding="utf-8")
        nodes = content.count('<node ')
        edges = content.count('<edge ')
        graph_size_kb = round(graph_file.stat().st_size / 1024, 1)

    if chunks_file.exists():
        try:
            data = json.loads(chunks_file.read_text())
            chunks = len(data.get("data", {}).get("embedding_data", {}))
        except Exception:
            chunks = 0

    return GraphStats(nodes=nodes, edges=edges, chunks=chunks, graph_file_size_kb=graph_size_kb)


@app.get("/api/ingestion-status")
async def get_ingestion_status():
    return ingestion_status


@app.get("/api/ingested-files")
async def list_ingested_files():
    files = [f.name for f in DATA_DIR.glob("*.txt")]
    return {"files": files, "count": len(files)}


# ── Serve the React frontend (production build) ────────────────────────────────
frontend_build = Path("frontend/dist")
if frontend_build.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_build / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        index = frontend_build / "index.html"
        return FileResponse(str(index))
