"""Small, focused services used by the FastAPI routes."""
from .embedding_service import GeminiEmbeddingError, GeminiEmbeddingService
from .rag_service import GeminiRagError, GeminiRagService
from .tag_service import GeminiTagError, GeminiTagService
from .flashcard_service import GeminiFlashcardError, GeminiFlashcardService
from .quiz_service import GeminiQuizError, GeminiQuizService
from .vector_store import QdrantStoreError, QdrantVectorStore
from .pdf_extraction_service import PdfExtractionError, PdfExtractionResult, PdfTextExtractor
from .text_chunking import TextChunk, TextPage, split_pages_into_chunks

__all__ = [
    "PdfExtractionError",
    "PdfExtractionResult",
    "PdfTextExtractor",
    "GeminiEmbeddingError",
    "GeminiEmbeddingService",
    "GeminiRagError",
    "GeminiRagService",
    "GeminiTagError",
    "GeminiTagService",
    "GeminiFlashcardError",
    "GeminiFlashcardService",
    "GeminiQuizError",
    "GeminiQuizService",
    "TextChunk",
    "TextPage",
    "split_pages_into_chunks",
]
