import os
from functools import partial

from dotenv import load_dotenv
from lightrag import LightRAG, QueryParam
from lightrag.llm.gemini import gemini_model_complete, gemini_embed
from lightrag.base import EmbeddingFunc

from src.tokenizer import make_tokenizer

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LLM_MODEL = "gemini-2.5-flash"
EMBED_MODEL = "gemini-embedding-001"
WORKING_DIR = os.getenv("RAG_STORAGE_DIR", "rag_storage")

VALID_MODES = ["naive", "local", "global", "hybrid", "mix"]


def build_rag() -> LightRAG:
    """
    Assemble and return a fully configured LightRAG instance backed by Gemini.
    - LLM  : gemini-2.5-flash  (entity extraction + answer synthesis)
    - Embed: gemini-embedding-001 (3072-dim vectors)
    - Storage: local filesystem (no external DB required)
    """
    if not GEMINI_API_KEY:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. "
            "Add it to your .env file or export it as an environment variable."
        )

    llm_func = partial(
        gemini_model_complete,
        api_key=GEMINI_API_KEY,
    )

    # embedding_dim MUST match what gemini-embedding-001 actually returns (3072).
    # Use gemini_embed.func (not gemini_embed) to strip the pre-baked 1536-dim decorator.
    embed_func = EmbeddingFunc(
        embedding_dim=3072,
        max_token_size=2048,
        func=partial(gemini_embed.func, api_key=GEMINI_API_KEY),
    )

    rag = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=llm_func,
        llm_model_name=LLM_MODEL,
        embedding_func=embed_func,
        tokenizer=make_tokenizer(),
    )
    return rag
