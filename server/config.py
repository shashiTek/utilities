"""
server/config.py
--------------------
Loads every configurable value from environment variables (via .env).
Import Config from here everywhere — never call os.getenv() directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the shared utilities root
_ROOT = Path(__file__).resolve().parents[2]
print(f"Loading environment variables from: {_ROOT / '.env'}")
load_dotenv(_ROOT /".env")


@dataclass(frozen=True)
class Config:
    # --- MongoDB ---
    mongo_uri: str    = field(default_factory=lambda: os.getenv("MONGO_URI", "mongodb://localhost:27017/"))
    db_name:   str    = field(default_factory=lambda: os.getenv("DB_NAME",   "elite_prospects_db"))

    # --- Collection names ---
    league_members_collection: str = field(default_factory=lambda: os.getenv("LEAGUE_MEMBERS_COLLECTION", "league_members"))
    teams_collection:          str = field(default_factory=lambda: os.getenv("TEAMS_COLLECTION",          "teams"))
    players_collection:        str = field(default_factory=lambda: os.getenv("PLAYERS_COLLECTION",        "players"))
    stats_collection:          str = field(default_factory=lambda: os.getenv("STATS_COLLECTION",          "stats"))

    # --- Scraper targets ---
    ep_league_slug: str = field(default_factory=lambda: os.getenv("EP_LEAGUE_SLUG", "ushs-prep"))
    ep_target_year: int = field(default_factory=lambda: int(os.getenv("EP_TARGET_YEAR", "2025")))

    # --- HTTP behaviour ---
    scrape_delay_min:    float = field(default_factory=lambda: float(os.getenv("SCRAPE_DELAY_MIN",    "1.5")))
    scrape_delay_max:    float = field(default_factory=lambda: float(os.getenv("SCRAPE_DELAY_MAX",    "3.0")))
    rate_limit_backoff:  int   = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_BACKOFF",   "60")))
    max_retries:         int   = field(default_factory=lambda: int(os.getenv("MAX_RETRIES",          "3")))
    request_timeout:     int   = field(default_factory=lambda: int(os.getenv("REQUEST_TIMEOUT",      "30")))

    # --- Logging ---
    log_level: str      = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    log_file:  str|None = field(default_factory=lambda: os.getenv("LOG_FILE") or None)

    # --- Derived / constants ---
    ep_base_url: str = "https://www.eliteprospects.com"
    http_headers: dict = field(default_factory=lambda: {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    })

    @property
    def season_slug(self) -> str:
        """Derive the EP season slug from the target year. e.g. 2025 → '2025-2026'."""
        return f"{self.ep_target_year}-{self.ep_target_year + 1}"

    def __post_init__(self) -> None:
        if self.scrape_delay_min > self.scrape_delay_max:
            raise ValueError("SCRAPE_DELAY_MIN must be ≤ SCRAPE_DELAY_MAX")
        if self.ep_target_year < 2000 or self.ep_target_year > 2100:
            raise ValueError(f"EP_TARGET_YEAR={self.ep_target_year} looks wrong")


# Singleton — import this everywhere
settings = Config()
