from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader

from app.config import Settings
from app.services.text_chunking import TextChunk, TextPage, split_pages_into_chunks


class DocumentExtractionError(Exception):
    """A supported document could not be read into usable text."""


# Compatibility name retained for the Phase 6 guide and imports.
PdfExtractionError = DocumentExtractionError


@dataclass(frozen=True)
class DocumentExtractionResult:
    pages: list[TextPage]
    chunks: list[TextChunk]


PdfExtractionResult = DocumentExtractionResult


class DocumentTextExtractor:
    """Load a private document, normalize its text, then create LangChain chunks."""

    supported_formats = {"pdf", "docx", "txt", "md"}

    def __init__(self, settings: Settings):
        self.max_text_chars = settings.max_pdf_text_chars
        self.chunk_size = settings.chunk_size_chars
        self.chunk_overlap = settings.chunk_overlap_chars

    def extract(self, source_url: str, document_format: str = "pdf") -> DocumentExtractionResult:
        normalized_format = document_format.lower()
        if normalized_format not in self.supported_formats:
            raise DocumentExtractionError("Only PDF, DOCX, TXT, and Markdown documents are supported.")

        document_bytes = (
            self._download_pdf(source_url)
            if normalized_format == "pdf"
            else self._download_document(source_url)
        )
        try:
            pages = self._extract_pages(document_bytes, normalized_format)
        except DocumentExtractionError:
            raise
        except Exception as error:
            raise DocumentExtractionError("This document is damaged or could not be read.") from error

        if not pages:
            if normalized_format == "pdf":
                raise DocumentExtractionError(
                    "No selectable text was found. Image-only scanned PDFs are not supported yet."
                )
            raise DocumentExtractionError("No readable text was found in this document.")

        return DocumentExtractionResult(
            pages=pages,
            chunks=split_pages_into_chunks(pages, self.chunk_size, self.chunk_overlap),
        )

    def _download_document(self, source_url: str) -> bytes:
        if urlparse(source_url).scheme != "https":
            raise DocumentExtractionError("The private document link is invalid. Please try processing again.")

        try:
            request = Request(source_url, headers={"User-Agent": "AI-Notes-Platform/0.1"})
            with urlopen(request, timeout=20) as response:
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > 10 * 1024 * 1024:
                    raise DocumentExtractionError("Documents must be 10 MB or smaller.")
                document_bytes = response.read(10 * 1024 * 1024 + 1)
        except DocumentExtractionError:
            raise
        except (HTTPError, URLError, OSError, ValueError) as error:
            raise DocumentExtractionError(
                "The private document could not be downloaded. Please try again."
            ) from error

        if len(document_bytes) > 10 * 1024 * 1024:
            raise DocumentExtractionError("Documents must be 10 MB or smaller.")
        return document_bytes

    def _download_pdf(self, source_url: str) -> bytes:
        """Compatibility seam used by the existing real-PDF parser test."""
        return self._download_document(source_url)

    def _extract_pages(self, document_bytes: bytes, document_format: str) -> list[TextPage]:
        temporary_path: str | None = None
        try:
            with NamedTemporaryFile(suffix=f".{document_format}", delete=False) as temporary_file:
                temporary_file.write(document_bytes)
                temporary_path = temporary_file.name

            if document_format == "pdf":
                documents = PyPDFLoader(temporary_path, mode="page").load()
            elif document_format == "docx":
                documents = Docx2txtLoader(temporary_path).load()
            else:
                documents = TextLoader(temporary_path, encoding="utf-8").load()
        finally:
            if temporary_path:
                Path(temporary_path).unlink(missing_ok=True)

        pages: list[TextPage] = []
        total_characters = 0
        for position, document in enumerate(documents, start=1):
            page_number = (
                int(document.metadata.get("page", position - 1)) + 1
                if document_format == "pdf"
                else position
            )
            text = document.page_content or ""
            normalized_text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
            if not normalized_text:
                continue

            total_characters += len(normalized_text)
            if total_characters > self.max_text_chars:
                raise DocumentExtractionError(
                    "This document contains too much text to process at once. Try a smaller file."
                )
            pages.append(TextPage(page_number, normalized_text))

        return pages


# Compatibility name retained while the project moves from PDF-only to multi-format loading.
PdfTextExtractor = DocumentTextExtractor
