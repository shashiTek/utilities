"""
ep_scraper/db/mongo.py
----------------------
MongoRepository — a thin base class that every scraper inherits from.
Provides:
  - Connection lifecycle management
  - Upsert helper with duplicate-key handling
  - Context-manager support (with MongoRepository(...) as repo:)
"""

from __future__ import annotations

from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError, DuplicateKeyError, PyMongoError

from ep_scraper.config import settings
from ep_scraper.utils.logger import get_logger

log = get_logger(__name__)


class MongoRepository:
    """
    Base class for all collection-specific repositories.

    Usage::

        class LeagueMembersRepo(MongoRepository):
            collection_name = settings.league_members_collection

        with LeagueMembersRepo() as repo:
            repo.upsert({"url": "..."}, {"name": "Albany Academy"})
    """

    collection_name: str  # subclasses must define this

    def __init__(self) -> None:
        self._client: MongoClient | None = None
        self._collection: Collection | None = None

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Open the MongoDB connection and ping to confirm it's alive."""
        self._client = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5_000,
        )
        try:
            self._client.admin.command("ping")
            log.info("Connected to MongoDB: %s / %s", settings.mongo_uri, settings.db_name)
        except PyMongoError as exc:
            raise ConnectionError(f"Cannot reach MongoDB: {exc}") from exc

        db = self._client[settings.db_name]
        self._collection = db[self.collection_name]

    def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
            log.info("MongoDB connection closed.")

    def __enter__(self) -> "MongoRepository":
        self.connect()
        return self

    def __exit__(self, *_) -> None:
        self.disconnect()

    # ------------------------------------------------------------------
    # Convenience properties
    # ------------------------------------------------------------------

    @property
    def col(self) -> Collection:
        if self._collection is None:
            raise RuntimeError("Call connect() or use the context manager first.")
        return self._collection

    @property
    def db(self):
        if self._client is None:
            raise RuntimeError("Not connected.")
        return self._client[settings.db_name]

    # ------------------------------------------------------------------
    # Shared write helpers
    # ------------------------------------------------------------------

    def upsert(self, filter_doc: dict, data: dict) -> bool:
        """
        Upsert a single document.

        Returns True if a new document was inserted, False if an existing one
        was updated (or unchanged).
        """
        try:
            result = self.col.update_one(filter_doc, {"$set": data}, upsert=True)
            return result.upserted_id is not None
        except DuplicateKeyError:
            log.debug("Duplicate key — skipping: %s", filter_doc)
            return False
        except PyMongoError as exc:
            log.error("Upsert failed for %s: %s", filter_doc, exc)
            raise

    def count(self, query: dict | None = None) -> int:
        return self.col.count_documents(query or {})

    def ensure_index(self, keys: list[tuple[str, int]], unique: bool = False) -> None:
        """Create an index if it does not already exist."""
        self.col.create_index(keys, unique=unique, background=True)
        log.debug("Index ensured on %s: %s", self.collection_name, keys)

    def find(self, query: dict, projection: dict | None = None):
        return self.col.find(query, projection)

    def find_one(self, query: dict, projection: dict | None = None):
        return self.col.find_one(query, projection)

    def update_one(self, filter_doc: dict, update: dict, upsert: bool = False):
        return self.col.update_one(filter_doc, update, upsert=upsert)

    def update_many(self, filter_doc: dict, update: dict):
        return self.col.update_many(filter_doc, update)

    def delete_many(self, filter_doc: dict):
        return self.col.delete_many(filter_doc)

    def aggregate(self, pipeline: list[dict]) -> list[Any]:
        return list(self.col.aggregate(pipeline))
