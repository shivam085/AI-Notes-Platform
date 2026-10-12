from dataclasses import dataclass
import os

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    """Configuration read once when the FastAPI application starts."""

    gemini_api_key: str | None
    gemini_model: str
    ai_service_token: str | None
    max_summary_input_chars: int = 12_000
    max_pdf_text_chars: int = 500_000
    chunk_size_chars: int = 2_000
    chunk_overlap_chars: int = 200
    embedding_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    max_embedding_input_chars: int = 2_000
    max_rag_context_chunks: int = 4
    max_rag_context_chars: int = 7_000
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "ai_notes_chunks"

    @classmethod
    def from_environment(cls) -> "Settings":
        load_dotenv()
        return cls(
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            ai_service_token=os.getenv("AI_SERVICE_TOKEN"),
            embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
            embedding_dimensions=int(os.getenv("GEMINI_EMBEDDING_DIMENSIONS", "768")),
            max_rag_context_chunks=int(os.getenv("RAG_MAX_CONTEXT_CHUNKS", "4")),
            max_rag_context_chars=int(os.getenv("RAG_MAX_CONTEXT_CHARS", "7000")),
            qdrant_url=os.getenv("QDRANT_URL") or None,
            qdrant_api_key=os.getenv("QDRANT_API_KEY") or None,
            qdrant_collection=os.getenv("QDRANT_COLLECTION", "ai_notes_chunks"),
        )
