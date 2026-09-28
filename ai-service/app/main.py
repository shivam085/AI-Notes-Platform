from typing import Annotated, Protocol

from fastapi import FastAPI, Header, HTTPException, status

from app.config import Settings
from app.schemas import SummarizeRequest, SummarizeResponse
from app.services.gemini_service import GeminiServiceError, GeminiSummaryService


class SummaryService(Protocol):
    def summarize(self, text: str) -> str: ...


def create_app(settings: Settings | None = None, summarizer: SummaryService | None = None) -> FastAPI:
    settings = settings or Settings.from_environment()
    summarizer = summarizer or GeminiSummaryService(settings)
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

    return app


app = create_app()
