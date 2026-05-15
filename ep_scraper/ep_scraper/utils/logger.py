"""
Centralised logger factory.
All modules call get_logger(__name__) — output format and level
are controlled by LOG_LEVEL / LOG_FILE in .env.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path


def get_logger(name: str) -> logging.Logger:
    from ep_scraper.config import settings  # lazy import avoids circular

    logger = logging.getLogger(name)

    if logger.handlers:          # already configured — return cached
        return logger

    logger.setLevel(settings.log_level.upper())

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # --- stdout handler (always) ---
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    # --- file handler (optional) ---
    if settings.log_file:
        log_path = Path(settings.log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    logger.propagate = False
    return logger
