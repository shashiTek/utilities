"""
server/scripts/run_all.py
------------------------------
CLI entry-point: runs the full 4-step pipeline in order.

    ep-run-all                 # uses .env defaults
    ep-run-all --year 2024
    ep-run-all --reset-teams   # wipe teams and restart
"""

from __future__ import annotations

import argparse
import sys

from server.scrapers import (
    OrganizationScraper,
    PlayerScraper,
    StatsScraper,
    TeamScraper,
)
from server.utils.logger import get_logger

log = get_logger("run_all")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the full EliteProspects scraper pipeline."
    )
    parser.add_argument(
        "--year", type=int, default=None,
        help="Season start year (default: EP_TARGET_YEAR from .env)"
    )
    parser.add_argument(
        "--reset-teams", action="store_true",
        help="Wipe the teams collection and restart (prompts for confirmation)"
    )
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("  EliteProspects Scraper Pipeline")
    log.info("=" * 60)

    steps = [
        ("1/4 — Organizations → league_members", lambda: OrganizationScraper().run()),
        ("2/4 — Teams         → teams",          lambda: TeamScraper(target_year=args.year, reset=args.reset_teams).run()),
        ("3/4 — Players       → players",         lambda: PlayerScraper().run()),
        ("4/4 — Stats         → stats",           lambda: StatsScraper().run()),
    ]

    for label, fn in steps:
        log.info(">>> STEP %s", label)
        try:
            count = fn()
            log.info("    Done — %d records processed.\n", count)
        except Exception as exc:
            log.error("    FAILED: %s\n", exc)
            sys.exit(1)

    log.info("Pipeline complete.")


if __name__ == "__main__":
    main()
