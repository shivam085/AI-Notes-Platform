import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.pdf_extraction_service import PdfExtractionResult, PdfTextExtractor
from app.services.text_chunking import TextChunk, TextPage, split_pages_into_chunks


class FakeSummaryService:
    def summarize(self, text: str) -> str:
        return f"Summary for: {text}"


class FakePdfExtractor:
    def extract(self, source_url: str) -> PdfExtractionResult:
        if source_url == "https://files.example/empty.pdf":
            from app.services.pdf_extraction_service import PdfExtractionError
            raise PdfExtractionError("No selectable text was found. Image-only scanned PDFs are not supported yet.")
        page = TextPage(page_number=2, text="Database indexes make repeated lookups faster.")
        return PdfExtractionResult(pages=[page], chunks=[TextChunk(position=0, page_number=2, text=page.text)])


def minimal_text_pdf(text: str) -> bytes:
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for number, object_body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n".encode() + object_body + b"\nendobj\n"
    xref_offset = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    pdf += b"".join(f"{offset:010} 00000 n \n".encode() for offset in offsets[1:])
    return pdf + f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()


class BytesPdfExtractor(PdfTextExtractor):
    def __init__(self, settings: Settings, pdf_bytes: bytes):
        super().__init__(settings)
        self.pdf_bytes = pdf_bytes

    def _download_pdf(self, source_url: str) -> bytes:
        return self.pdf_bytes


class AiServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings("not-used-by-this-test", "test-model", "local-test-token")
        self.client = TestClient(create_app(settings, FakeSummaryService(), FakePdfExtractor()))

    def test_health(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_summary_requires_internal_token(self) -> None:
        response = self.client.post("/internal/summarize", json={"text": "A saved note."})
        self.assertEqual(response.status_code, 401)

    def test_summary_returns_injected_service_result(self) -> None:
        response = self.client.post(
            "/internal/summarize",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"text": "A saved note."},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"summary": "Summary for: A saved note."})

    def test_pdf_extraction_requires_internal_token(self) -> None:
        response = self.client.post("/internal/extract-pdf", json={"source_url": "https://files.example/revision.pdf"})
        self.assertEqual(response.status_code, 401)

    def test_pdf_extraction_returns_page_aware_chunks(self) -> None:
        response = self.client.post(
            "/internal/extract-pdf",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"source_url": "https://files.example/revision.pdf"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pages"][0]["page_number"], 2)
        self.assertEqual(response.json()["chunks"][0]["position"], 0)

    def test_pdf_extraction_returns_a_clear_scanned_pdf_error(self) -> None:
        response = self.client.post(
            "/internal/extract-pdf",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"source_url": "https://files.example/empty.pdf"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("No selectable text", response.json()["detail"])

    def test_real_pdf_parser_extracts_text_and_keeps_its_page_number(self) -> None:
        extractor = BytesPdfExtractor(
            Settings("not-used-by-this-test", "test-model", "local-test-token"),
            minimal_text_pdf("Indexes speed up repeated lookups."),
        )
        result = extractor.extract("https://files.example/revision.pdf")
        self.assertEqual(result.pages[0].page_number, 1)
        self.assertIn("Indexes speed up", result.pages[0].text)
        self.assertEqual(result.chunks[0].page_number, 1)

    def test_langchain_chunking_uses_overlap_and_preserves_page_metadata(self) -> None:
        chunks = split_pages_into_chunks(
            [TextPage(page_number=4, text="database " * 80)],
            chunk_size=100,
            overlap=20,
        )
        self.assertGreater(len(chunks), 1)
        self.assertEqual([chunk.position for chunk in chunks], list(range(len(chunks))))
        self.assertTrue(all(chunk.page_number == 4 for chunk in chunks))
        self.assertTrue(all(chunk.text for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
