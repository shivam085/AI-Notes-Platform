from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12_000)


class SummarizeResponse(BaseModel):
    summary: str


class TagSuggestionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    text: str = Field(min_length=1, max_length=12_000)


class TagSuggestionResponse(BaseModel):
    tags: list[str] = Field(min_length=3, max_length=5)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str]) -> list[str]:
        normalized_tags: list[str] = []

        for tag in tags:
            if not isinstance(tag, str):
                raise ValueError("Each suggested tag must be text.")

            normalized_tag = " ".join(tag.strip().lower().split())
            if not normalized_tag or len(normalized_tag) > 30:
                raise ValueError("Suggested tags must contain 1 to 30 characters.")
            if normalized_tag not in normalized_tags:
                normalized_tags.append(normalized_tag)

        if len(normalized_tags) < 3:
            raise ValueError("At least three distinct suggested tags are required.")

        return normalized_tags


class FlashcardGenerationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    text: str = Field(min_length=1, max_length=12_000)


class Flashcard(BaseModel):
    question: str = Field(min_length=1, max_length=240)
    answer: str = Field(min_length=1, max_length=1_000)

    @field_validator("question", "answer")
    @classmethod
    def trim_card_text(cls, value: str) -> str:
        trimmed_value = " ".join(value.strip().split())
        if not trimmed_value:
            raise ValueError("Flashcard text cannot be empty.")
        return trimmed_value


class FlashcardGenerationResponse(BaseModel):
    cards: list[Flashcard] = Field(min_length=5, max_length=5)


class QuizGenerationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    text: str = Field(min_length=1, max_length=12_000)


class QuizQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=240)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_option_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=1, max_length=1_000)

    @field_validator("question", "explanation")
    @classmethod
    def trim_quiz_text(cls, value: str) -> str:
        trimmed_value = " ".join(value.strip().split())
        if not trimmed_value:
            raise ValueError("Quiz text cannot be empty.")
        return trimmed_value

    @field_validator("options")
    @classmethod
    def normalize_options(cls, options: list[str]) -> list[str]:
        normalized_options: list[str] = []

        for option in options:
            normalized_option = " ".join(option.strip().split()) if isinstance(option, str) else ""
            if not normalized_option or len(normalized_option) > 240:
                raise ValueError("Each quiz option must contain 1 to 240 characters.")
            if normalized_option in normalized_options:
                raise ValueError("Quiz options must be different.")
            normalized_options.append(normalized_option)

        return normalized_options


class QuizGenerationResponse(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=5, max_length=5)


class ExtractPdfRequest(BaseModel):
    source_url: str = Field(min_length=1, max_length=4_000)


class ExtractedPage(BaseModel):
    page_number: int = Field(ge=1)
    text: str = Field(min_length=1)


class ExtractedChunk(BaseModel):
    position: int = Field(ge=0)
    page_number: int = Field(ge=1)
    text: str = Field(min_length=1)


class ExtractPdfResponse(BaseModel):
    pages: list[ExtractedPage]
    chunks: list[ExtractedChunk]


class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)
    purpose: Literal["document", "query"]


class EmbedResponse(BaseModel):
    embedding: list[float]
    dimensions: int = Field(ge=1)


class IndexChunk(BaseModel):
    chunk_id: str = Field(min_length=1, max_length=100)
    owner_id: str = Field(min_length=1, max_length=100)
    source_type: Literal["document", "note"]
    source_id: str = Field(min_length=1, max_length=100)
    position: int = Field(ge=0)
    page_number: int | None = Field(default=None, ge=1)
    text: str = Field(min_length=1, max_length=2_000)
    title: str = Field(min_length=1, max_length=180)
    folder_id: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=10)


class IndexChunksRequest(BaseModel):
    chunks: list[IndexChunk] = Field(min_length=1, max_length=100)


class IndexChunksResponse(BaseModel):
    indexed_count: int = Field(ge=0)


class SemanticSearchRequest(BaseModel):
    owner_id: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=2_000)
    limit: int = Field(default=5, ge=1, le=10)
    source_type: Literal["document", "note"] | None = None
    folder_id: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=10)


class SemanticSearchResult(BaseModel):
    chunk_id: str
    source_type: Literal["document", "note"]
    source_id: str
    title: str
    page_number: int | None = None
    position: int = Field(ge=0)
    text: str
    score: float


class SemanticSearchResponse(BaseModel):
    results: list[SemanticSearchResult]


class RagContext(BaseModel):
    chunk_id: str = Field(min_length=1, max_length=100)
    source_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    page_number: int | None = Field(default=None, ge=1)
    text: str = Field(min_length=1, max_length=2_000)


class RagQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2_000)
    contexts: list[RagContext] = Field(default_factory=list, max_length=4)


class RagAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=12_000)
    grounded: bool
