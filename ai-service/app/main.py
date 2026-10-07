from typing import Annotated, Protocol

from fastapi import FastAPI, Header, HTTPException, status

from app.config import Settings
from app.schemas import ExtractPdfRequest, ExtractPdfResponse, ExtractedChunk, ExtractedPage, SummarizeRequest, SummarizeResponse
from app.services.gemini_service import GeminiServiceError, GeminiSummaryService
from app.services.pdf_extraction_service import PdfExtractionError, PdfTextExtractor


class SummaryService(Protocol):
    def summarize(self, text: str) -> str: ...


class PdfExtractionService(Protocol):
    def extract(self, source_url: str): ...


def create_app(
    settings: Settings | None = None,
    summarizer: SummaryService | None = None,
    pdf_extractor: PdfExtractionService | None = None,
) -> FastAPI:
    settings = settings or Settings.from_environment()
    summarizer = summarizer or GeminiSummaryService(settings)
    pdf_extractor = pdf_extractor or PdfTextExtractor(settings)
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

    return app


app = create_app()
