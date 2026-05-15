import asyncio
import sys
from pathlib import Path

from src.rag_engine import build_rag


async def ingest_folder(folder: str) -> dict:
    """
    Ingest all .txt files in a folder in a single LightRAG session.
    More efficient than calling ingest_file() per file because
    storage is initialized only once.
    """
    folder_path = Path(folder)
    txt_files = sorted(folder_path.glob("*.txt"))

    if not txt_files:
        print(f"[ingest_folder] No .txt files found in {folder}")
        return {"ingested": 0, "files": []}

    print(f"[ingest_folder] Found {len(txt_files)} files in {folder}")

    rag = build_rag()
    await rag.initialize_storages()

    ingested = []
    for file in txt_files:
        text = file.read_text(encoding="utf-8")
        print(f"[ingest_folder] Ingesting: {file.name} ({len(text):,} chars)")
        await rag.ainsert(text, file_paths=str(file))
        ingested.append(file.name)

    await rag.finalize_storages()
    print(f"[ingest_folder] Done. {len(ingested)} documents ingested.")
    return {"ingested": len(ingested), "files": ingested}


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "data"
    asyncio.run(ingest_folder(folder))
