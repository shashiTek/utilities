"""
ep_scraper/utils/helpers.py
---------------------------
Pure utility functions shared across all scrapers.
No side-effects, no I/O — safe to import anywhere.
"""

from __future__ import annotations

import re


EP_BASE = "https://www.eliteprospects.com"


def year_to_season(year: int) -> str:
    """
    Convert a calendar start-year to an EP season slug.

    >>> year_to_season(2025)
    '2025-2026'
    >>> year_to_season(2024)
    '2024-2025'
    """
    return f"{year}-{year + 1}"


def league_name_to_slug(name: str) -> str:
    """
    Convert a human-readable league name to an EP URL slug.

    >>> league_name_to_slug("USHS-Prep")
    'ushs-prep'
    >>> league_name_to_slug("NCAA D-I")
    'ncaa-d-i'
    """
    return name.lower().replace(" ", "-") if name else ""


def normalise_url(url: str) -> str:
    """
    Ensure a URL is absolute (prepend EP_BASE if needed) and strip trailing slash.

    >>> normalise_url("/player/1114621/benjamin-art")
    'https://www.eliteprospects.com/player/1114621/benjamin-art'
    >>> normalise_url("https://www.eliteprospects.com/player/1/foo/")
    'https://www.eliteprospects.com/player/1/foo'
    """
    url = (url or "").strip().rstrip("/")
    if not url:
        return ""
    if not url.startswith("http"):
        url = EP_BASE + url
    return url


def extract_player_id(player_url: str) -> str | None:
    """
    Extract the numeric EP player ID from any player URL.

    >>> extract_player_id("https://www.eliteprospects.com/player/1114621/benjamin-art")
    '1114621'
    """
    m = re.search(r"/player/(\d+)/", player_url or "")
    return m.group(1) if m else None


def safe_int(value: object) -> int | None:
    """Cast to int, return None on failure."""
    try:
        return int(str(value).strip())
    except (ValueError, TypeError, AttributeError):
        return None


def safe_float(value: object) -> float | None:
    """Cast to float (strips '%'), return None on failure."""
    try:
        return float(str(value).strip().replace("%", ""))
    except (ValueError, TypeError, AttributeError):
        return None
