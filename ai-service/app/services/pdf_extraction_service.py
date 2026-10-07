from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from langchain_community.document_loaders import PyPDFLoader

from app.config import Settings
from app.services.text_chunking import TextChunk, TextPage, split_pages_into_chunks


class PdfExtractionError(Exception):
    """A PDF could not be read into usable, selectable text."""


@dataclass(frozen=True)
class PdfExtractionResult:
    pages: list[TextPage]
    chunks: list[TextChunk]


class PdfTextExtractor:
    def __init__(self, settings: Settings):
        self.max_text_chars = settings.max_pdf_text_chars
        self.chunk_size = settings.chunk_size_chars
        self.chunk_overlap = settings.chunk_overlap_chars

    def extract(self, source_url: str) -> PdfExtractionResult:
        pdf_bytes = self._download_pdf(source_url)
        try:
            pages = self._extract_pages(pdf_bytes)
        except PdfExtractionError:
            raise
        # PDF internals can fail in several library-specific ways. All of them
        # mean this user file cannot safely provide readable text.
        except Exception as error:
            raise PdfExtractionError("This PDF is damaged or could not be read.") from error

        if not pages:
            raise PdfExtractionError("No selectable text was found. Image-only scanned PDFs are not supported yet.")

        return PdfExtractionResult(
            pages=pages,
            chunks=split_pages_into_chunks(pages, self.chunk_size, self.chunk_overlap),
        )

    def _download_pdf(self, source_url: str) -> bytes:
        if urlparse(source_url).scheme != "https":
            raise PdfExtractionError("The private PDF link is invalid. Please try processing again.")

        try:
            request = Request(source_url, headers={"User-Agent": "AI-Notes-Platform/0.1"})
            with urlopen(request, timeout=20) as response:
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > 10 * 1024 * 1024:
                    raise PdfExtractionError("PDF files must be 10 MB or smaller.")
                pdf_bytes = response.read(10 * 1024 * 1024 + 1)
        except PdfExtractionError:
            raise
        except (HTTPError, URLError, OSError, ValueError) as error:
            raise PdfExtractionError("The private PDF could not be downloaded. Please try again.") from error

        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise PdfExtractionError("PDF files must be 10 MB or smaller.")
        return pdf_bytes

    def _extract_pages(self, pdf_bytes: bytes) -> list[TextPage]:
        # PyPDFLoader is the course's document-loader step. It returns one
        # LangChain Document per page, with page metadata that we preserve.
        temporary_path: str | None = None
        try:
            with NamedTemporaryFile(suffix=".pdf", delete=False) as temporary_file:
                temporary_file.write(pdf_bytes)
                temporary_path = temporary_file.name
            documents = PyPDFLoader(temporary_path, mode="page").load()
        finally:
            if temporary_path:
                Path(temporary_path).unlink(missing_ok=True)

        pages: list[TextPage] = []
        total_characters = 0

        for position, document in enumerate(documents, start=1):
            page_number = int(document.metadata.get("page", position - 1)) + 1
            text = document.page_content or ""
            normalized_text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
            if not normalized_text:
                continue

            total_characters += len(normalized_text)
            if total_characters > self.max_text_chars:
                raise PdfExtractionError("This PDF contains too much text to process at once. Try a smaller PDF.")
            pages.append(TextPage(page_number, normalized_text))

        return pages
