"""
common/config.py
--------------------
Centralized configuration for utilities (api-services, server, web backend).
Loads every configurable value from environment variables (via .env).
Import Config or settings from here everywhere — never call os.getenv() directly.

Usage:
  from common.config import Config, settings
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the shared utilities root
_ROOT = Path(__file__).resolve().parents[1]
_ENV_PATH = _ROOT / '.env'
print(f"Loading environment variables from: {_ENV_PATH}")
load_dotenv(_ENV_PATH, override=True)


def _get_required_str(key: str) -> str:
    """Get a required string environment variable or raise an error."""
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Missing required environment variable: {key}")
    return value


def _get_required_int(key: str) -> int:
    """Get a required integer environment variable or raise an error."""
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Missing required environment variable: {key}")
    try:
        return int(value)
    except ValueError as e:
        raise ValueError(f"Invalid integer value for {key}: {value}") from e


def _get_required_float(key: str) -> float:
    """Get a required float environment variable or raise an error."""
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Missing required environment variable: {key}")
    try:
        return float(value)
    except ValueError as e:
        raise ValueError(f"Invalid float value for {key}: {value}") from e


def _get_optional_str(key: str) -> str | None:
    """Get an optional string environment variable."""
    return os.getenv(key)


def _get_optional_int(key: str, default: int = None) -> int:
    """Get an optional integer environment variable with a default."""
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as e:
        raise ValueError(f"Invalid integer value for {key}: {value}") from e


@dataclass(frozen=True)
class Config:
    # --- MongoDB ---
    mongo_uri: str    = field(default_factory=lambda: _get_required_str("MONGO_URI"))
    db_name:   str    = field(default_factory=lambda: _get_required_str("DB_NAME"))

    # --- Collection names ---
    league_members_collection: str = field(default_factory=lambda: _get_required_str("LEAGUE_MEMBERS_COLLECTION"))
    teams_collection:          str = field(default_factory=lambda: _get_required_str("TEAMS_COLLECTION"))
    players_collection:        str = field(default_factory=lambda: _get_required_str("PLAYERS_COLLECTION"))
    stats_collection:          str = field(default_factory=lambda: _get_required_str("STATS_COLLECTION"))

    # --- Scraper targets ---
    ep_league_slug: str = field(default_factory=lambda: _get_required_str("EP_LEAGUE_SLUG"))
    ep_target_year: int = field(default_factory=lambda: _get_required_int("EP_TARGET_YEAR"))
    
    # --- Recruitment analysis ---
    aging_out_years_threshold: int = field(default_factory=lambda: _get_optional_int("AGING_OUT_YEARS_THRESHOLD", 3))
    
    # --- HTTP behaviour ---
    scrape_delay_min:    float = field(default_factory=lambda: _get_required_float("SCRAPE_DELAY_MIN"))
    scrape_delay_max:    float = field(default_factory=lambda: _get_required_float("SCRAPE_DELAY_MAX"))
    rate_limit_backoff:  int   = field(default_factory=lambda: _get_required_int("RATE_LIMIT_BACKOFF"))
    max_retries:         int   = field(default_factory=lambda: _get_required_int("MAX_RETRIES"))
    request_timeout:     int   = field(default_factory=lambda: _get_required_int("REQUEST_TIMEOUT"))

    # --- Logging ---
    log_level: str      = field(default_factory=lambda: _get_required_str("LOG_LEVEL"))
    log_file:  str|None = field(default_factory=lambda: _get_optional_str("LOG_FILE"))

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
