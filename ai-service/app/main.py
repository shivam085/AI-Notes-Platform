from typing import Annotated, Protocol

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status

from app.config import Settings
from app.schemas import (
    DeleteSourceVectorsRequest,
    DeleteSourceVectorsResponse,
    EmbedRequest,
    EmbedResponse,
    ExtractDocumentRequest,
    ExtractPdfResponse,
    ExtractedChunk,
    ExtractedPage,
    FlashcardGenerationResponse,
    IndexChunksRequest,
    IndexChunksResponse,
    QuizGenerationResponse,
    RagAnswer,
    RagQuestionRequest,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SplitTextRequest,
    SplitTextResponse,
    SummarizeRequest,
    SummarizeResponse,
    StudyRequest,
    TagSuggestionResponse,
)
from app.services.embedding_service import GeminiEmbeddingError, GeminiEmbeddingService
from app.services.gemini_service import GeminiServiceError, GeminiSummaryService
from app.services.pdf_extraction_service import DocumentExtractionError, DocumentTextExtractor
from app.services.rag_service import GeminiRagError, GeminiRagService
from app.services.study_service import GeminiStudyError, GeminiStudyService
from app.services.vector_store import QdrantStoreError, QdrantVectorStore
from app.services.text_chunking import TextPage, split_pages_into_chunks


class SummaryService(Protocol):
    def summarize(self, text: str) -> str: ...


class PdfExtractionService(Protocol):
    def extract(self, source_url: str, document_format: str = "pdf"): ...


class EmbeddingService(Protocol):
    def embed_document(self, text: str) -> list[float]: ...

    def embed_query(self, text: str) -> list[float]: ...


class RagService(Protocol):
    def answer_question(self, question: str, contexts) -> RagAnswer: ...


class TagService(Protocol):
    def suggest_tags(self, title: str, text: str) -> list[str]: ...


class FlashcardService(Protocol):
    def generate_flashcards(self, title: str, text: str) -> list[dict[str, str]]: ...


class QuizService(Protocol):
    def generate_quiz(self, title: str, text: str) -> list[dict]: ...


def create_app(
    settings: Settings | None = None,
    summarizer: SummaryService | None = None,
    pdf_extractor: PdfExtractionService | None = None,
    embedder: EmbeddingService | None = None,
    vector_store: QdrantVectorStore | None = None,
    rag_service: RagService | None = None,
    tag_service: TagService | None = None,
    flashcard_service: FlashcardService | None = None,
    quiz_service: QuizService | None = None,
) -> FastAPI:
    settings = settings or Settings.from_environment()
    summarizer = summarizer or GeminiSummaryService(settings)
    pdf_extractor = pdf_extractor or DocumentTextExtractor(settings)
    embedder = embedder or GeminiEmbeddingService(settings)
    vector_store = vector_store or QdrantVectorStore(settings)
    rag_service = rag_service or GeminiRagService(settings)
    study_generator = GeminiStudyService(settings)
    tag_service = tag_service or study_generator
    flashcard_service = flashcard_service or study_generator
    quiz_service = quiz_service or study_generator
    app = FastAPI(title="AI Notes Platform AI Service", version="0.1.0")

    def require_internal_token(x_ai_service_token: Annotated[str | None, Header()] = None):
        if not settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service authentication is not configured.")
        if x_ai_service_token != settings.ai_service_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service authentication failed.")

    internal = APIRouter(dependencies=[Depends(require_internal_token)])

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @internal.post("/internal/summarize", response_model=SummarizeResponse)
    def summarize(
        request: SummarizeRequest,
    ) -> SummarizeResponse:
        try:
            return SummarizeResponse(summary=summarizer.summarize(request.text))
        except GeminiServiceError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/suggest-tags", response_model=TagSuggestionResponse)
    def suggest_tags(
        request: StudyRequest,
    ) -> TagSuggestionResponse:
        try:
            return TagSuggestionResponse(tags=tag_service.suggest_tags(request.title, request.text))
        except GeminiStudyError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/generate-flashcards", response_model=FlashcardGenerationResponse)
    def generate_flashcards(
        request: StudyRequest,
    ) -> FlashcardGenerationResponse:
        try:
            return FlashcardGenerationResponse(cards=flashcard_service.generate_flashcards(request.title, request.text))
        except GeminiStudyError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/generate-quiz", response_model=QuizGenerationResponse)
    def generate_quiz(
        request: StudyRequest,
    ) -> QuizGenerationResponse:
        try:
            return QuizGenerationResponse(questions=quiz_service.generate_quiz(request.title, request.text))
        except GeminiStudyError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/extract-pdf", response_model=ExtractPdfResponse)
    @internal.post("/internal/extract-document", response_model=ExtractPdfResponse)
    def extract_document(
        request: ExtractDocumentRequest,
    ) -> ExtractPdfResponse:
        try:
            result = pdf_extractor.extract(request.source_url, request.format)
            return ExtractPdfResponse(
                pages=[ExtractedPage(page_number=page.page_number, text=page.text) for page in result.pages],
                chunks=[ExtractedChunk(position=chunk.position, page_number=chunk.page_number, text=chunk.text) for chunk in result.chunks],
            )
        except DocumentExtractionError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error

    @internal.post("/internal/split-text", response_model=SplitTextResponse)
    def split_text(
        request: SplitTextRequest,
    ) -> SplitTextResponse:
        """Split a saved note with the same LangChain rules used for documents."""

        chunks = split_pages_into_chunks(
            [TextPage(page_number=1, text=request.text)],
            settings.chunk_size_chars,
            settings.chunk_overlap_chars,
        )
        return SplitTextResponse(
            chunks=[ExtractedChunk(position=chunk.position, page_number=1, text=chunk.text) for chunk in chunks]
        )

    @internal.post("/internal/embed", response_model=EmbedResponse)
    def embed(
        request: EmbedRequest,
    ) -> EmbedResponse:

        try:
            embedding = embedder.embed_document(request.text) if request.purpose == "document" else embedder.embed_query(request.text)
            return EmbedResponse(embedding=embedding, dimensions=len(embedding))
        except GeminiEmbeddingError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/index-chunks", response_model=IndexChunksResponse)
    def index_chunks(
        request: IndexChunksRequest,
    ) -> IndexChunksResponse:
        try:
            return IndexChunksResponse(indexed_count=vector_store.index_chunks(request.chunks, embedder))
        except (GeminiEmbeddingError, QdrantStoreError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/semantic-search", response_model=SemanticSearchResponse)
    def semantic_search(
        request: SemanticSearchRequest,
    ) -> SemanticSearchResponse:
        try:
            return SemanticSearchResponse(results=vector_store.search(request, embedder))
        except (GeminiEmbeddingError, QdrantStoreError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/delete-source-vectors", response_model=DeleteSourceVectorsResponse)
    def delete_source_vectors(
        request: DeleteSourceVectorsRequest,
    ) -> DeleteSourceVectorsResponse:
        try:
            vector_store.delete_source(request.owner_id, request.source_id)
            return DeleteSourceVectorsResponse(deleted=True)
        except QdrantStoreError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    @internal.post("/internal/answer-question", response_model=RagAnswer)
    def answer_question(
        request: RagQuestionRequest,
    ) -> RagAnswer:
        try:
            return rag_service.answer_question(request.question, request.contexts)
        except GeminiRagError as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    app.include_router(internal)
    return app


app = create_app()
