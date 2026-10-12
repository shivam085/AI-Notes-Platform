from google import genai
from google.genai import types

from app.config import Settings


class GeminiEmbeddingError(Exception):
    """Gemini could not produce an embedding with the expected shape."""


class GeminiEmbeddingService:
    """Create matching vectors for stored chunks and a user's search query."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def embed_document(self, text: str) -> list[float]:
        return self._embed(text, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text, "RETRIEVAL_QUERY")

    def _embed(self, text: str, task_type: str) -> list[float]:
        if not self.settings.gemini_api_key:
            raise GeminiEmbeddingError("Gemini is not configured yet.")

        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
            response = client.models.embed_content(
                model=self.settings.embedding_model,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=self.settings.embedding_dimensions,
                ),
            )
            embedding = response.embeddings[0].values if response.embeddings else []
        except Exception as error:  # Provider errors must not be returned to the browser.
            raise GeminiEmbeddingError("Gemini could not create an embedding.") from error

        values = [float(value) for value in embedding]
        if len(values) != self.settings.embedding_dimensions:
            raise GeminiEmbeddingError("Gemini returned an embedding with an unexpected size.")
        return values
