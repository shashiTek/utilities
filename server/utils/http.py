"""
server/utils/http.py
------------------------
Reusable HTTP client wrapping requests.Session.
Handles 403 rate-limiting, exponential backoff, and polite sleep delays.
"""

from __future__ import annotations

import random
import time

import requests

from common.config import settings
from server.utils.logger import get_logger

log = get_logger(__name__)


class HttpClient:
    """
    Thin wrapper around requests.Session with:
      - Shared browser-like headers
      - 403-aware retry with configurable backoff
      - Randomised polite delay between requests
    """

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update(settings.http_headers)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, url: str) -> str | None:
        """
        Perform a GET request with retry logic.

        Returns the response text on success, or None on permanent failure
        (404, exhausted retries).
        """
        for attempt in range(1, settings.max_retries + 1):
            try:
                resp = self._session.get(url, timeout=settings.request_timeout)

                if resp.status_code == 403:
                    wait = settings.rate_limit_backoff * attempt
                    log.warning(
                        "[403] Rate limited on %s — sleeping %ds (attempt %d/%d)",
                        url, wait, attempt, settings.max_retries,
                    )
                    time.sleep(wait)
                    continue

                if resp.status_code == 404:
                    log.debug("[404] Not found: %s", url)
                    return None

                resp.raise_for_status()
                return resp.text

            except requests.exceptions.RequestException as exc:
                log.warning(
                    "[NET] Attempt %d/%d failed for %s: %s",
                    attempt, settings.max_retries, url, exc,
                )
                if attempt < settings.max_retries:
                    time.sleep(5 * attempt)

        log.error("All %d attempts failed for %s", settings.max_retries, url)
        return None

    def polite_sleep(self) -> None:
        """Sleep a random interval between requests to avoid overloading EP."""
        duration = random.uniform(settings.scrape_delay_min, settings.scrape_delay_max)
        log.debug("Sleeping %.2fs", duration)
        time.sleep(duration)

    def close(self) -> None:
        self._session.close()

    # Support use as context manager
    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *_) -> None:
        self.close()
