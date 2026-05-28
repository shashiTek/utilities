"""
server/scrapers/base.py
---------------------------
Abstract base class all scrapers inherit from.
Wires together HttpClient + MongoRepository + logging.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from common.config import settings
from server.db.mongo import MongoRepository
from server.utils.http import HttpClient
from server.utils.logger import get_logger


class BaseScraper(ABC):
    """
    All scrapers extend this class and implement run().

    Typical pattern::

        class MyScraper(BaseScraper):
            def run(self) -> int:
                with self.http:
                    with self.repo:
                        ...
                        return rows_processed
    """

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo
        self.http = HttpClient()
        self.log  = get_logger(self.__class__.__name__)
        self.cfg  = settings

    @abstractmethod
    def run(self) -> int:
        """Execute the scraper. Returns the count of records processed."""
        ...
