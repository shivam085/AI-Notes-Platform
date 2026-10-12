from typing import Annotated, Protocol

from fastapi import FastAPI, Header, HTTPException, status

from app.config import Settings
from app.schemas import EmbedRequest, EmbedResponse, ExtractPdfRequest, ExtractPdfResponse, ExtractedChunk, ExtractedPage, IndexChunksRequest, IndexChunksResponse, RagAnswer, RagQuestionRequest, SemanticSearchRequest, SemanticSearchResponse, SummarizeRequest, SummarizeResponse
from app.services.embedding_service import GeminiEmbeddingError, GeminiEmbeddingService
from app.services.gemini_service import GeminiServiceError, GeminiSummaryService
from app.services.pdf_extraction_service import PdfExtractionError, PdfTextExtractor
from app.services.rag_service import GeminiRagError, GeminiRagService
from app.services.vector_store import QdrantStoreError, QdrantVectorStore


class SummaryService(Protocol):
    def summarize(self, text: str) -> str: ...


class PdfExtractionService(Protocol):
    def extract(self, source_url: str): ...


class EmbeddingService(Protocol):
    def embed_document(self, text: str) -> list[float]: ...

    def embed_query(self, text: str) -> list[float]: ...


class RagService(Protocol):
    def answer_question(self, question: str, contexts) -> RagAnswer: ...


def create_app(
    settings: Settings | None = None,
    summarizer: SummaryService | None = None,
    pdf_extractor: PdfExtractionService | None = None,
    embedder: EmbeddingService | None = None,
    vector_store: QdrantVectorStore | None = None,
    rag_service: RagService | None = None,
) -> FastAPI:
    settings = settings or Settings.from_environment()
    summarizer = summarizer or GeminiSummaryService(settings)
    pdf_extractor = pdf_extractor or PdfTextExtractor(settings)
    embedder = embedder or GeminiEmbeddingService(settings)
    vector_store = vector_store or QdrantVectorStore(settings)
    rag_service = rag_service or GeminiRagService(settings)
    app = FastAPI(title="AI Notes Platform AI Service", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/internal/summarize", response_model=SummarizeResponse)
    def summarize(
        request: SummarizeRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> SummarizeResponse:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")
        try:
            return SummarizeResponse(summary=summarizer.summarize(request.text))
        except GeminiServiceError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @app.post("/internal/extract-pdf", response_model=ExtractPdfResponse)
    def extract_pdf(
        request: ExtractPdfRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> ExtractPdfResponse:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")
        try:
            result = pdf_extractor.extract(request.source_url)
            return ExtractPdfResponse(
                pages=[ExtractedPage(page_number=page.page_number, text=page.text) for page in result.pages],
                chunks=[ExtractedChunk(position=chunk.position, page_number=chunk.page_number, text=chunk.text) for chunk in result.chunks],
            )
        except PdfExtractionError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error

    @app.post("/internal/embed", response_model=EmbedResponse)
    def embed(
        request: EmbedRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> EmbedResponse:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")

        try:
            embedding = embedder.embed_document(request.text) if request.purpose == "document" else embedder.embed_query(request.text)
            return EmbedResponse(embedding=embedding, dimensions=len(embedding))
        except GeminiEmbeddingError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @app.post("/internal/index-chunks", response_model=IndexChunksResponse)
    def index_chunks(
        request: IndexChunksRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> IndexChunksResponse:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")
        try:
            return IndexChunksResponse(indexed_count=vector_store.index_chunks(request.chunks, embedder))
        except (GeminiEmbeddingError, QdrantStoreError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @app.post("/internal/semantic-search", response_model=SemanticSearchResponse)
    def semantic_search(
        request: SemanticSearchRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> SemanticSearchResponse:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")
        try:
            return SemanticSearchResponse(results=vector_store.search(request, embedder))
        except (GeminiEmbeddingError, QdrantStoreError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @app.post("/internal/answer-question", response_model=RagAnswer)
    def answer_question(
        request: RagQuestionRequest,
        x_ai_service_token: Annotated[str | None, Header()] = None,
    ) -> RagAnswer:
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")
        try:
            return rag_service.answer_question(request.question, request.contexts)
        except GeminiRagError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    return app


app = create_app()
