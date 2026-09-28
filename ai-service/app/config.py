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

    @classmethod
    def from_environment(cls) -> "Settings":
        load_dotenv()
        return cls(
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            ai_service_token=os.getenv("AI_SERVICE_TOKEN"),
        )
