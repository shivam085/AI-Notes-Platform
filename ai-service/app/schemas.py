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
