import unittest
import json
from unittest.mock import patch
from io import BytesIO
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.pdf_extraction_service import DocumentTextExtractor, PdfExtractionResult, PdfTextExtractor
from app.services.text_chunking import TextChunk, TextPage, split_pages_into_chunks
from app.schemas import IndexChunk, QuizGenerationResponse, RagAnswer, SemanticSearchRequest, SemanticSearchResult, TagSuggestionResponse
from app.services.vector_store import QdrantStoreError, QdrantVectorStore
from app.services.study_service import GeminiStudyError, GeminiStudyService
from qdrant_client import QdrantClient, models


class FakeSummaryService:
    def summarize(self, text: str) -> str:
        return f"Summary for: {text}"


class FakePdfExtractor:
    def extract(self, source_url: str, document_format: str = "pdf") -> PdfExtractionResult:
        if source_url == "https://files.example/empty.pdf":
            from app.services.pdf_extraction_service import PdfExtractionError
            raise PdfExtractionError("No selectable text was found. Image-only scanned PDFs are not supported yet.")
        page = TextPage(page_number=2, text="Database indexes make repeated lookups faster.")
        return PdfExtractionResult(pages=[page], chunks=[TextChunk(position=0, page_number=2, text=page.text)])


class FakeEmbeddingService:
    def embed_document(self, text: str) -> list[float]:
        return [1.0, float(len(text))]

    def embed_query(self, text: str) -> list[float]:
        return [2.0, float(len(text))]


class FakeVectorStore:
    def __init__(self) -> None:
        self.indexed_chunks: list[IndexChunk] = []
        self.search_requests: list[SemanticSearchRequest] = []
        self.deleted_sources: list[tuple[str, str]] = []

    def index_chunks(self, chunks: list[IndexChunk], embedder: FakeEmbeddingService) -> int:
        self.indexed_chunks = chunks
        return len(chunks)

    def search(self, request: SemanticSearchRequest, embedder: FakeEmbeddingService) -> list[SemanticSearchResult]:
        self.search_requests.append(request)
        return [
            SemanticSearchResult(
                chunk_id="chunk-1",
                source_type="document",
                source_id="document-1",
                title="Indexes",
                page_number=1,
                position=0,
                text="Indexes speed up lookups.",
                score=0.92,
            )
        ]

    def delete_source(self, owner_id: str, source_id: str) -> None:
        self.deleted_sources.append((owner_id, source_id))


class FakeRagService:
    def __init__(self) -> None:
        self.calls = []

    def answer_question(self, question, contexts) -> RagAnswer:
        self.calls.append({"question": question, "contexts": contexts})
        return RagAnswer(answer="Indexes make repeated lookups faster.", grounded=True)


class FakeTagService:
    def __init__(self) -> None:
        self.calls = []

    def suggest_tags(self, title: str, text: str) -> list[str]:
        self.calls.append({"title": title, "text": text})
        return ["database", "revision", "indexes"]


class FakeFlashcardService:
    def __init__(self) -> None:
        self.calls = []

    def generate_flashcards(self, title: str, text: str) -> list[dict[str, str]]:
        self.calls.append({"title": title, "text": text})
        return [{"question": f"Question {number}", "answer": f"Answer {number}"} for number in range(1, 6)]


class FakeQuizService:
    def __init__(self) -> None:
        self.calls = []

    def generate_quiz(self, title: str, text: str) -> list[dict]:
        self.calls.append({"title": title, "text": text})
        return [
            {
                "question": f"Question {number}",
                "options": ["First", "Second", "Third", "Fourth"],
                "correct_option_index": number % 4,
                "explanation": f"Explanation {number}",
            }
            for number in range(1, 6)
        ]


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


class BytesDocumentExtractor(DocumentTextExtractor):
    def __init__(self, settings: Settings, document_bytes: bytes):
        super().__init__(settings)
        self.document_bytes = document_bytes

    def _download_document(self, source_url: str) -> bytes:
        return self.document_bytes


def minimal_docx(text: str) -> bytes:
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>'
    )
    stream = BytesIO()
    with ZipFile(stream, "w") as archive:
        archive.writestr("word/document.xml", document_xml)
    return stream.getvalue()


class AiServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings("not-used-by-this-test", "test-model", "local-test-token")
        self.vector_store = FakeVectorStore()
        self.rag_service = FakeRagService()
        self.tag_service = FakeTagService()
        self.flashcard_service = FakeFlashcardService()
        self.quiz_service = FakeQuizService()
        self.client = TestClient(create_app(settings, FakeSummaryService(), FakePdfExtractor(), FakeEmbeddingService(), self.vector_store, self.rag_service, self.tag_service, self.flashcard_service, self.quiz_service))

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

    def test_tag_suggestions_require_internal_token(self) -> None:
        response = self.client.post(
            "/internal/suggest-tags",
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 401)

    def test_tag_suggestions_return_validated_tags(self) -> None:
        response = self.client.post(
            "/internal/suggest-tags",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"tags": ["database", "revision", "indexes"]})
        self.assertEqual(self.tag_service.calls[0]["title"], "Database revision")

    def test_tag_suggestion_schema_normalizes_duplicate_tags(self) -> None:
        suggestions = TagSuggestionResponse(tags=[" Database ", "database", "Revision", "Study"])
        self.assertEqual(suggestions.tags, ["database", "revision", "study"])

    def test_flashcard_generation_requires_internal_token(self) -> None:
        response = self.client.post(
            "/internal/generate-flashcards",
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 401)

    def test_flashcard_generation_returns_five_validated_cards(self) -> None:
        response = self.client.post(
            "/internal/generate-flashcards",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["cards"]), 5)
        self.assertEqual(self.flashcard_service.calls[0]["text"], "Indexes make lookups faster.")

    def test_quiz_generation_requires_internal_token(self) -> None:
        response = self.client.post(
            "/internal/generate-quiz",
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 401)

    def test_quiz_generation_returns_five_validated_questions(self) -> None:
        response = self.client.post(
            "/internal/generate-quiz",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"title": "Database revision", "text": "Indexes make lookups faster."},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["questions"]), 5)
        self.assertEqual(response.json()["questions"][0]["correct_option_index"], 1)
        self.assertEqual(self.quiz_service.calls[0]["text"], "Indexes make lookups faster.")

    def test_quiz_schema_rejects_duplicate_options(self) -> None:
        with self.assertRaises(ValueError):
            QuizGenerationResponse(questions=[{
                "question": f"Question {number}",
                "options": ["Same", "Same", "Third", "Fourth"],
                "correct_option_index": 0,
                "explanation": "An explanation.",
            } for number in range(1, 6)])

    def test_pdf_extraction_requires_internal_token(self) -> None:
        response = self.client.post("/internal/extract-pdf", json={"source_url": "https://files.example/revision.pdf"})
        self.assertEqual(response.status_code, 401)

    def test_embedding_requires_internal_token(self) -> None:
        response = self.client.post("/internal/embed", json={"text": "Database indexes", "purpose": "query"})
        self.assertEqual(response.status_code, 401)

    def test_embedding_uses_distinct_document_and_query_tasks(self) -> None:
        document_response = self.client.post(
            "/internal/embed",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"text": "Database indexes", "purpose": "document"},
        )
        query_response = self.client.post(
            "/internal/embed",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"text": "Database indexes", "purpose": "query"},
        )
        self.assertEqual(document_response.status_code, 200)
        self.assertEqual(document_response.json(), {"embedding": [1.0, 16.0], "dimensions": 2})
        self.assertEqual(query_response.status_code, 200)
        self.assertEqual(query_response.json(), {"embedding": [2.0, 16.0], "dimensions": 2})

    def test_indexing_requires_internal_token(self) -> None:
        response = self.client.post(
            "/internal/index-chunks",
            json={
                "chunks": [{
                    "chunk_id": "chunk-1",
                    "owner_id": "user-1",
                    "source_type": "document",
                    "source_id": "document-1",
                    "position": 0,
                    "text": "Indexes speed up lookups.",
                    "title": "Indexes",
                }]
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_indexing_and_search_keep_the_owner_filter(self) -> None:
        indexed = self.client.post(
            "/internal/index-chunks",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={
                "chunks": [{
                    "chunk_id": "chunk-1",
                    "owner_id": "user-1",
                    "source_type": "document",
                    "source_id": "document-1",
                    "position": 0,
                    "page_number": 1,
                    "text": "Indexes speed up lookups.",
                    "title": "Indexes",
                    "folder_id": "study",
                    "tags": ["database"],
                }]
            },
        )
        self.assertEqual(indexed.status_code, 200)
        self.assertEqual(indexed.json(), {"indexed_count": 1})
        self.assertEqual(self.vector_store.indexed_chunks[0].owner_id, "user-1")

        searched = self.client.post(
            "/internal/semantic-search",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"owner_id": "user-1", "query": "faster database retrieval", "tags": ["database"]},
        )
        self.assertEqual(searched.status_code, 200)
        self.assertEqual(searched.json()["results"][0]["source_id"], "document-1")
        self.assertEqual(self.vector_store.search_requests[0].owner_id, "user-1")
        self.assertEqual(self.vector_store.search_requests[0].tags, ["database"])

    def test_rag_answer_requires_the_internal_token(self) -> None:
        response = self.client.post(
            "/internal/answer-question",
            json={"question": "How do indexes help?", "contexts": []},
        )
        self.assertEqual(response.status_code, 401)

    def test_rag_answer_receives_the_question_and_rechecked_context(self) -> None:
        response = self.client.post(
            "/internal/answer-question",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={
                "question": "How do indexes help?",
                "contexts": [{
                    "chunk_id": "chunk-1",
                    "source_id": "document-1",
                    "title": "Database revision",
                    "page_number": 2,
                    "text": "Indexes make repeated lookups faster.",
                }],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"answer": "Indexes make repeated lookups faster.", "grounded": True})
        self.assertEqual(self.rag_service.calls[0]["question"], "How do indexes help?")
        self.assertEqual(self.rag_service.calls[0]["contexts"][0].title, "Database revision")

    def test_pdf_extraction_returns_page_aware_chunks(self) -> None:
        response = self.client.post(
            "/internal/extract-pdf",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"source_url": "https://files.example/revision.pdf"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pages"][0]["page_number"], 2)
        self.assertEqual(response.json()["chunks"][0]["position"], 0)

    def test_document_extraction_accepts_txt_and_preserves_a_section_number(self) -> None:
        response = self.client.post(
            "/internal/extract-document",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"source_url": "https://files.example/revision.txt", "format": "txt"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pages"][0]["page_number"], 2)

    def test_saved_note_text_uses_the_shared_langchain_splitter(self) -> None:
        response = self.client.post(
            "/internal/split-text",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"text": "database " * 600},
        )

        self.assertEqual(response.status_code, 200)
        chunks = response.json()["chunks"]
        self.assertGreater(len(chunks), 1)
        self.assertEqual([chunk["position"] for chunk in chunks], list(range(len(chunks))))
        self.assertTrue(all(chunk["page_number"] == 1 for chunk in chunks))

    def test_real_txt_and_docx_loaders_create_chunks(self) -> None:
        settings = Settings("not-used-by-this-test", "test-model", "local-test-token")
        text_result = BytesDocumentExtractor(settings, b"Indexes speed up repeated lookups.").extract(
            "https://files.example/revision.txt", "txt"
        )
        self.assertIn("Indexes speed up", text_result.pages[0].text)
        self.assertEqual(text_result.chunks[0].page_number, 1)

        docx_result = BytesDocumentExtractor(settings, minimal_docx("Transactions keep data consistent.")).extract(
            "https://files.example/revision.docx", "docx"
        )
        self.assertIn("Transactions keep data consistent", docx_result.pages[0].text)

    def test_vector_deletion_keeps_owner_and_source_together(self) -> None:
        response = self.client.post(
            "/internal/delete-source-vectors",
            headers={"X-AI-Service-Token": "local-test-token"},
            json={"owner_id": "user-1", "source_id": "document-1"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": True})
        self.assertEqual(self.vector_store.deleted_sources, [("user-1", "document-1")])

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

    def test_qdrant_owner_filter_excludes_another_users_vector(self) -> None:
        settings = Settings(
            "not-used-by-this-test",
            "test-model",
            "local-test-token",
            embedding_dimensions=2,
            qdrant_url="https://qdrant.example.test",
            qdrant_api_key="test-key",
            qdrant_collection="test_chunks",
        )
        client = QdrantClient(location=":memory:")
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=models.VectorParams(size=2, distance=models.Distance.COSINE),
        )
        store = QdrantVectorStore(settings, client=client)
        # The isolated test client does not implement cloud payload indexes.
        store.collection_ready = True
        embedder = FakeEmbeddingService()
        store.index_chunks([
            IndexChunk(
                chunk_id="owned-chunk",
                owner_id="user-1",
                source_type="document",
                source_id="document-1",
                position=0,
                page_number=1,
                text="Database indexes make repeated lookups faster.",
                title="Database revision",
                tags=["database"],
            ),
            IndexChunk(
                chunk_id="private-chunk",
                owner_id="user-2",
                source_type="document",
                source_id="document-2",
                position=0,
                page_number=1,
                text="This is another user's private content.",
                title="Private document",
            ),
        ], embedder)

        results = store.search(SemanticSearchRequest(owner_id="user-1", query="database lookup"), embedder)
        self.assertEqual([result.chunk_id for result in results], ["owned-chunk"])
        store.client.close()

    def test_qdrant_cloud_configuration_is_required_without_an_injected_test_client(self) -> None:
        settings = Settings("not-used-by-this-test", "test-model", "local-test-token")
        store = QdrantVectorStore(settings)

        with self.assertRaisesRegex(QdrantStoreError, "Qdrant Cloud is not configured"):
            store._create_client()


class SharedStudyServiceTests(unittest.TestCase):
    def test_each_prompt_uses_its_schema_and_validates_provider_json(self):
        settings = Settings("test-key", "test-model", "test-token")
        service = GeminiStudyService(settings)
        cases = [
            (service.suggest_tags, {"tags": ["database", "indexes", "revision"]}, "tags"),
            (service.generate_flashcards, {"cards": FakeFlashcardService().generate_flashcards("", "")}, "cards"),
            (service.generate_quiz, {"questions": FakeQuizService().generate_quiz("", "")}, "questions"),
        ]
        with patch("app.services.study_service.genai.Client") as factory:
            client = factory.return_value.__enter__.return_value
            for generate, payload, field in cases:
                with self.subTest(feature=field):
                    client.models.generate_content.return_value.text = json.dumps(payload)
                    result = generate("Indexes", "Indexes speed up repeated lookups.")
                    self.assertEqual(result, payload[field])
                    call = client.models.generate_content.call_args.kwargs
                    self.assertEqual(call["model"], "test-model")
                    self.assertIn("Indexes speed up repeated lookups.", call["contents"])
                    self.assertIn("untrusted reference material", call["contents"])
                    self.assertEqual(call["config"].response_mime_type, "application/json")
                    self.assertIn(field, call["config"].response_schema.model_fields)
            self.assertEqual(factory.call_args.kwargs["http_options"].timeout, settings.gemini_request_timeout_ms)

    def test_bad_output_and_provider_failures_return_safe_errors(self):
        service = GeminiStudyService(Settings("test-key", "test-model", "test-token"))
        with patch("app.services.study_service.genai.Client") as factory:
            generate = factory.return_value.__enter__.return_value.models.generate_content
            for bad_output in ['not json', '{"cards": []}']:
                generate.return_value.text = bad_output
                with self.assertRaisesRegex(GeminiStudyError, "invalid study material"):
                    service.generate_flashcards("Indexes", "Reference text")
            generate.side_effect = RuntimeError("sensitive provider details")
            with self.assertRaisesRegex(GeminiStudyError, "could not create study material") as raised:
                service.generate_quiz("Indexes", "Reference text")
            self.assertNotIn("sensitive", str(raised.exception))

    def test_all_internal_routes_require_the_shared_token(self):
        app = create_app(Settings("test-key", "test-model", "test-token"))
        with TestClient(app) as client:
            paths = [path for path in app.openapi()["paths"] if path.startswith("/internal/")]
            self.assertGreater(len(paths), 0)
            for path in paths:
                with self.subTest(path=path):
                    self.assertEqual(client.post(path, json={}).status_code, 401)
                    self.assertEqual(client.post(path, json={}, headers={"X-AI-Service-Token": "wrong"}).status_code, 401)
            self.assertEqual(client.get("/health").status_code, 200)

    def test_missing_internal_configuration_fails_closed(self):
        app = create_app(Settings("test-key", "test-model", None))
        with TestClient(app) as client:
            self.assertEqual(client.post("/internal/generate-quiz", json={}).status_code, 503)


if __name__ == "__main__":
    unittest.main()
