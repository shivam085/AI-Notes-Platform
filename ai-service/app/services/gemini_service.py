import logging

from google import genai
from google.genai import types

from app.config import Settings

logger = logging.getLogger(__name__)


class GeminiServiceError(Exception):
    """Raised when Gemini cannot produce a usable answer."""


class GeminiSummaryService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def summarize(self, text: str) -> str:
        if not self.settings.gemini_api_key:
            raise GeminiServiceError("Gemini is not configured yet.")

        prompt = (
            "Summarize the note below in 3 to 5 short bullet points. "
            "Use only facts from the note. If it has too little information, say so.\n\n"
            "<note>\n"
            f"{text}\n"
            "</note>"
        )

        try:
            with genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=self.settings.gemini_request_timeout_ms),
            ) as client:
                response = client.models.generate_content(
                    model=self.settings.gemini_model,
                    contents=prompt,
                )
        except Exception as error:  # The provider error must not be sent to the browser.
            logger.error("Gemini summarize failed: %s: %s", type(error).__name__, error)
            raise GeminiServiceError("Gemini could not create a summary.") from error

        summary = (response.text or "").strip()
        if not summary:
            raise GeminiServiceError("Gemini returned an empty summary.")
        return summary
