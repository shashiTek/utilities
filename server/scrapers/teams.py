"""
server/scrapers/teams.py
-----------------------------
TeamScraper
Reads URLs from `league_members`, appends the dynamic target season parameter,
fetches the team page, extracts the SportsTeam JSON-LD, and upserts into `teams`.

Source : league_members collection
Target : teams collection
"""

from __future__ import annotations
import json
import sys
from bs4 import BeautifulSoup
from common.config import settings
from server.db.mongo import MongoRepository
from server.models.team import TeamDocument
from server.scrapers.base import BaseScraper

class LeagueMembersRepository(MongoRepository):
    collection_name = settings.league_members_collection

class TeamsRepository(MongoRepository):
    collection_name = settings.teams_collection

class TeamScraper(BaseScraper):
    """
    Iterates league_members and populates the teams collection for a specific season.
    
    Usage::
        scraper = TeamScraper(target_year=2024, reset=False)
        total = scraper.run()
    """
    def __init__(self, target_year: int | None = None, reset: bool = False) -> None:
        super().__init__(repo=TeamsRepository())
        self.target_year = target_year or settings.ep_target_year
        print(f"Target season: {self.target_year}-{self.target_year + 1}")
        self.reset = reset
        self._source_repo = LeagueMembersRepository()

    # ------------------------------------------------------------------
    def run(self) -> int:
        with self._source_repo:
            with self.repo:
                if self.reset:
                    self._handle_reset()

                # Dynamic season-specific progress tracking field key
                scraped_key = f"scraped_{self.target_year}"

                # Pull all valid URLs that have not been scraped for this target season yet
                search_filter = {
                    "url": {"$exists": True},
                    scraped_key: {"$ne": True}
                }

                members = list(self._source_repo.find(search_filter))
                
                self.log.info(
                    "Found %d unscraped league member(s) to process for target year %d.", 
                    len(members), self.target_year
                )
                
                if len(members) == 0:
                    self.log.warning(
                        "⚠️ 0 members found. Verification advice: check if your source "
                        "collection contains documents or if '%s' is already true everywhere.", scraped_key
                    )

                upserted = 0
                with self.http:
                    for doc in members:
                        count = self._process_member(doc, scraped_key)
                        upserted += count
                        self.http.polite_sleep()
                        
                self.log.info("TeamScraper finished. Upserted %d team records for year %d.", upserted, self.target_year)
                return upserted

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------
    def _process_member(self, member_doc: dict, scraped_key: str) -> int:
        doc_id = member_doc["_id"]
        base_url = member_doc.get("url", "").strip()
        team_name = member_doc.get("name", "Unknown")
        
        # FIX: Explicitly strip, clean, and inject the full URL parameters together
        season_slug = f"{self.target_year}-{self.target_year + 1}"
        
        if "season=" in base_url:
            # If a season param already exists, pass it through directly
            full_url = base_url
        else:
            connector = "&" if "?" in base_url else "?"
            full_url = f"{base_url}{connector}season={season_slug}"
            
        # FIX: Outputs the fully built, direct HTTP destination link directly to your console
        self.log.info("Fetching team: %s", team_name)
        print(f"FULL URL -> {full_url}")
        
        html = self.http.get(full_url)

        # Mark as scraped under this season's tracking namespace key flag
        self._source_repo.update_one(
            {"_id": doc_id}, 
            {"$set": {scraped_key: True}}
        )

        if not html:
            self.log.warning("No HTML returned for %s — skipped.", team_name)
            return 0

        team_data = self._parse_sports_team(html)
        if not team_data:
            self.log.warning("No SportsTeam JSON-LD data structure blocks found for %s.", team_name)
            return 0

        team_doc = TeamDocument.from_jsonld(team_data, self.target_year, doc_id)
        if not team_doc.main_entity_of_page:
            self.log.warning("Missing mainEntityOfPage configuration parameters for %s — skipped.", team_name)
            return 0

        self.repo.upsert(team_doc.upsert_filter, team_doc.to_dict())
        self.log.info("Saved %s (Season: %s).", team_name, season_slug)
        return 1

    @staticmethod
    def _parse_sports_team(html: str) -> dict | None:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(
            "script", attrs={"type": "application/ld+json", "data-next-head": ""}
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
        scraped_key = f"scraped_{self.target_year}"
        target_filter = {"year": self.target_year}
        count = self.repo.count_documents(target_filter) if hasattr(self.repo, 'count_documents') else self.repo.count()
        
        if count == 0:
            self.log.info("Teams collection is empty for year %d — ready.", self.target_year)
            return
            
        self.log.warning(
            "Teams collection has %d records for year %d. Wiping target season data only.", 
            count, self.target_year
        )
        
        self.repo.delete_many(target_filter)
        self._source_repo.update_many(
            {scraped_key: True}, 
            {"$set": {scraped_key: False}}
        )
        self.log.info("Reset complete for year %d.", self.target_year)
