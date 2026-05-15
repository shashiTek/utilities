"""
ep_scraper/scrapers/teams.py
-----------------------------
TeamScraper
  Reads every URL from `league_members`, fetches the team page,
  extracts the SportsTeam JSON-LD, and upserts into the `teams` collection.

  Source  : league_members collection
  Target  : teams collection
"""

from __future__ import annotations

import json
import sys

from bs4 import BeautifulSoup

from ep_scraper.config import settings
from ep_scraper.db.mongo import MongoRepository
from ep_scraper.models.team import TeamDocument
from ep_scraper.scrapers.base import BaseScraper


class LeagueMembersRepository(MongoRepository):
    collection_name = settings.league_members_collection


class TeamsRepository(MongoRepository):
    collection_name = settings.teams_collection


class TeamScraper(BaseScraper):
    """
    Iterates league_members and populates the teams collection.

    Usage::

        scraper = TeamScraper()
        total   = scraper.run()
    """

    def __init__(self, target_year: int | None = None, reset: bool = False) -> None:
        super().__init__(repo=TeamsRepository())
        self.target_year   = target_year or settings.ep_target_year
        self.reset         = reset
        self._source_repo  = LeagueMembersRepository()

    # ------------------------------------------------------------------

    def run(self) -> int:
        with self._source_repo:
            with self.repo:
                if self.reset:
                    self._handle_reset()

                members = list(
                    self._source_repo.find(
                        {"url": {"$exists": True}, "scraped": {"$ne": True}}
                    )
                )
                self.log.info(
                    "Found %d unscraped league member(s) to process.", len(members)
                )

                upserted = 0
                with self.http:
                    for doc in members:
                        count = self._process_member(doc)
                        upserted += count
                        self.http.polite_sleep()

        self.log.info("TeamScraper finished. Upserted %d team records.", upserted)
        return upserted

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _process_member(self, member_doc: dict) -> int:
        doc_id    = member_doc["_id"]
        url       = member_doc.get("url", "")
        team_name = member_doc.get("name", "Unknown")

        self.log.info("Fetching team: %s  (%s)", team_name, url)
        html = self.http.get(url)

        # Always mark as scraped so we don't retry broken pages forever
        self._source_repo.update_one(
            {"_id": doc_id}, {"$set": {"scraped": True}}
        )

        if not html:
            self.log.warning("No HTML for %s — skipped.", team_name)
            return 0

        team_data = self._parse_sports_team(html)
        if not team_data:
            self.log.warning("No SportsTeam JSON-LD found for %s.", team_name)
            return 0

        team_doc = TeamDocument.from_jsonld(team_data, self.target_year, doc_id)
        if not team_doc.main_entity_of_page:
            self.log.warning("Missing mainEntityOfPage for %s — skipped.", team_name)
            return 0

        self.repo.upsert(team_doc.upsert_filter, team_doc.to_dict())
        self.log.info("Saved %s (%d).", team_name, self.target_year)
        return 1

    @staticmethod
    def _parse_sports_team(html: str) -> dict | None:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(
            "script",
            attrs={"type": "application/ld+json", "data-next-head": ""},
        ):
            if not tag.string:
                continue
            try:
                data = json.loads(tag.string)
                if data.get("@type") == "SportsTeam":
                    return data
            except json.JSONDecodeError:
                continue
        return None

    def _handle_reset(self) -> None:
        count = self.repo.count()
        if count == 0:
            self.log.info("Teams collection is empty — ready.")
            return

        self.log.warning(
            "Teams collection has %d records. Pass reset=True only when "
            "you intentionally want to wipe and restart.", count
        )
        self.repo.delete_many({})
        self._source_repo.update_many({"scraped": True}, {"$set": {"scraped": False}})
        self.log.info("Reset complete.")
