from dataclasses import dataclass

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class TextPage:
    page_number: int
    text: str


@dataclass(frozen=True)
class TextChunk:
    position: int
    page_number: int
    text: str


def split_pages_into_chunks(
    pages: list[TextPage],
    chunk_size: int,
    overlap: int,
) -> list[TextChunk]:
    """Use LangChain's recursive splitter while preserving source pages.

    This follows the document-loader → Document → split_documents pattern from
    the selected course. A chunk stays inside one input page, so the project
    can later show the correct PDF page beside a search result or RAG answer.
    """
    if chunk_size < 1:
        raise ValueError("Chunk size must be at least 1 character.")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("Chunk overlap must be at least 0 and smaller than chunk size.")

    documents = [Document(page_content=page.text, metadata={"page_number": page.page_number}) for page in pages]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    split_documents = splitter.split_documents(documents)

    return [
        TextChunk(position, int(document.metadata["page_number"]), document.page_content)
        for position, document in enumerate(split_documents)
        if document.page_content
    ]
