from typing import Protocol
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient, models

from app.config import Settings
from app.schemas import IndexChunk, SemanticSearchRequest, SemanticSearchResult


class EmbeddingService(Protocol):
    def embed_document(self, text: str) -> list[float]: ...

    def embed_query(self, text: str) -> list[float]: ...


class QdrantStoreError(Exception):
    """Qdrant could not store or retrieve the project's vectors."""


class QdrantVectorStore:
    """Store chunk embeddings and search them with an owner filter inside Qdrant."""

    def __init__(self, settings: Settings, client: QdrantClient | None = None):
        self.settings = settings
        self.client = client
        self.collection_ready = False

    def _create_client(self) -> QdrantClient:
        if not self.settings.qdrant_url or not self.settings.qdrant_api_key:
            raise QdrantStoreError(
                "Qdrant Cloud is not configured. Set QDRANT_URL and QDRANT_API_KEY in ai-service/.env."
            )
        return QdrantClient(url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key)

    def _get_client(self) -> QdrantClient:
        if self.client is None:
            self.client = self._create_client()
        return self.client

    def index_chunks(self, chunks: list[IndexChunk], embedder: EmbeddingService) -> int:
        try:
            self._ensure_collection()
            client = self._get_client()
            # Do this first so a Gemini failure cannot remove an already searchable source.
            points = [
                models.PointStruct(
                    id=str(uuid5(NAMESPACE_URL, chunk.chunk_id)),
                    vector=embedder.embed_document(chunk.text),
                    payload={
                        "chunkId": chunk.chunk_id,
                        "ownerId": chunk.owner_id,
                        "sourceType": chunk.source_type,
                        "sourceId": chunk.source_id,
                        "position": chunk.position,
                        "pageNumber": chunk.page_number,
                        "text": chunk.text,
                        "title": chunk.title,
                        "folderId": chunk.folder_id,
                        "tags": chunk.tags,
                    },
                )
                for chunk in chunks
            ]
            for owner_id, source_id in {(chunk.owner_id, chunk.source_id) for chunk in chunks}:
                client.delete(
                    collection_name=self.settings.qdrant_collection,
                    points_selector=self._source_filter(owner_id, source_id),
                    wait=True,
                )
            client.upsert(collection_name=self.settings.qdrant_collection, points=points, wait=True)
            return len(points)
        except QdrantStoreError:
            raise
        except Exception as error:
            raise QdrantStoreError("Qdrant could not index the extracted text.") from error

    def search(self, request: SemanticSearchRequest, embedder: EmbeddingService) -> list[SemanticSearchResult]:
        try:
            self._ensure_collection()
            response = self._get_client().query_points(
                collection_name=self.settings.qdrant_collection,
                query=embedder.embed_query(request.query),
                query_filter=self._search_filter(request),
                with_payload=True,
                limit=request.limit,
            )
            return [
                SemanticSearchResult(
                    chunk_id=str(point.payload["chunkId"]),
                    source_type=point.payload["sourceType"],
                    source_id=str(point.payload["sourceId"]),
                    title=str(point.payload["title"]),
                    page_number=point.payload.get("pageNumber"),
                    position=point.payload["position"],
                    text=str(point.payload["text"]),
                    score=float(point.score),
                )
                for point in response.points
            ]
        except QdrantStoreError:
            raise
        except Exception as error:
            raise QdrantStoreError("Qdrant could not search the extracted text.") from error

    def _ensure_collection(self) -> None:
        if self.collection_ready:
            return
        client = self._get_client()
        if not client.collection_exists(self.settings.qdrant_collection):
            client.create_collection(
                collection_name=self.settings.qdrant_collection,
                vectors_config=models.VectorParams(
                    size=self.settings.embedding_dimensions,
                    distance=models.Distance.COSINE,
                ),
            )

        for field_name in ("ownerId", "sourceType", "sourceId", "folderId", "tags"):
            self._create_keyword_index(field_name)
        self.collection_ready = True

    def _create_keyword_index(self, field_name: str) -> None:
        self._get_client().create_payload_index(
            collection_name=self.settings.qdrant_collection,
            field_name=field_name,
            field_schema=models.PayloadSchemaType.KEYWORD,
            wait=True,
        )

    @staticmethod
    def _source_filter(owner_id: str, source_id: str) -> models.Filter:
        return models.Filter(
            must=[
                models.FieldCondition(key="ownerId", match=models.MatchValue(value=owner_id)),
                models.FieldCondition(key="sourceId", match=models.MatchValue(value=source_id)),
            ],
        )

    @staticmethod
    def _search_filter(request: SemanticSearchRequest) -> models.Filter:
        conditions = [models.FieldCondition(key="ownerId", match=models.MatchValue(value=request.owner_id))]
        if request.source_type:
            conditions.append(models.FieldCondition(key="sourceType", match=models.MatchValue(value=request.source_type)))
        if request.folder_id:
            conditions.append(models.FieldCondition(key="folderId", match=models.MatchValue(value=request.folder_id)))
        if request.tags:
            conditions.append(models.FieldCondition(key="tags", match=models.MatchAny(any=request.tags)))
        return models.Filter(must=conditions)
