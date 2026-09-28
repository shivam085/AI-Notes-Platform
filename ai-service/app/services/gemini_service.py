from google import genai

from app.config import Settings


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
            client = genai.Client(api_key=self.settings.gemini_api_key)
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
            )
        except Exception as error:  # The provider error must not be sent to the browser.
            raise GeminiServiceError("Gemini could not create a summary.") from error

        summary = (response.text or "").strip()
        if not summary:
            raise GeminiServiceError("Gemini returned an empty summary.")
        return summary
