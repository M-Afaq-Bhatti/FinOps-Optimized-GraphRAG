import asyncio
import sys
from pathlib import Path

from src.rag_engine import build_rag


async def ingest_file(path: str) -> dict:
    """
    Ingest a single .txt file into the LightRAG knowledge graph.
    Returns a summary dict for use by the API server.
    """
    file = Path(path)
    if not file.exists():
        raise FileNotFoundError(f"File not found: {path}")

    text = file.read_text(encoding="utf-8")
    char_count = len(text)
    word_count = len(text.split())

    print(f"[ingest] {file.name}  ({char_count:,} chars / {word_count:,} words)")

    rag = build_rag()
    await rag.initialize_storages()
    await rag.ainsert(text, file_paths=str(file))
    await rag.finalize_storages()

    print(f"[ingest] Done. Knowledge graph updated.")
    return {
        "file": file.name,
        "chars": char_count,
        "words": word_count,
        "status": "ingested",
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: PYTHONPATH=. uv run src/ingest.py <path/to/file.txt>")
        sys.exit(1)
    asyncio.run(ingest_file(sys.argv[1]))
