import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


class FakeSummaryService:
    def summarize(self, text: str) -> str:
        return f"Summary for: {text}"


class AiServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings("not-used-by-this-test", "test-model", "local-test-token")
        self.client = TestClient(create_app(settings, FakeSummaryService()))

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


if __name__ == "__main__":
    unittest.main()
