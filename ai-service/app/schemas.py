from typing import Literal

from pydantic import BaseModel, Field


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12_000)


class SummarizeResponse(BaseModel):
    summary: str


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
