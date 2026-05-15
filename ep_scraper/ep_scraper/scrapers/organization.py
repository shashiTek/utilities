"""
ep_scraper/scrapers/organization.py
------------------------------------
OrganizationScraper
  Fetches the EP league page, extracts the SportsOrganization JSON-LD,
  and upserts each member team URL into the `league_members` collection.

  Source  : https://www.eliteprospects.com/league/{EP_LEAGUE_SLUG}
  Target  : league_members collection
"""

from __future__ import annotations

import json

from bs4 import BeautifulSoup

from ep_scraper.config import settings
from ep_scraper.db.mongo import MongoRepository
from ep_scraper.scrapers.base import BaseScraper


class LeagueMembersRepository(MongoRepository):
    collection_name = settings.league_members_collection


class OrganizationScraper(BaseScraper):
    """
    Scrapes the league index page and populates league_members.

    Usage::

        scraper = OrganizationScraper()
        total   = scraper.run()
        print(f"Upserted {total} league member records.")
    """

    def __init__(self) -> None:
        super().__init__(repo=LeagueMembersRepository())

    # ------------------------------------------------------------------

    def run(self) -> int:
        league_url = f"{self.cfg.ep_base_url}/league/{self.cfg.ep_league_slug}"
        self.log.info("Fetching league page: %s", league_url)

        with self.http:
            html = self.http.get(league_url)

        if not html:
            self.log.error("Failed to fetch league page %s", league_url)
            return 0

        members = self._parse_members(html)
        if not members:
            self.log.warning("No SportsOrganization members found on %s", league_url)
            return 0

        self.log.info("Found %d member teams — upserting …", len(members))
        upserted = 0

        with self.repo:
            for member in members:
                url = member.get("url")
                if not url:
                    continue

                inserted = self.repo.upsert(
                    filter_doc={"url": url},
                    data={
                        "url":                 url,
                        "name":                member.get("name"),
                        "@type":               member.get("@type"),
                        "parent_organization": self._org_name,
                    },
                )
                if inserted:
                    upserted += 1
                    self.log.debug("Inserted: %s", member.get("name"))

        self.log.info("Done. Upserted %d / %d member records.", upserted, len(members))
        return upserted

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    _org_name: str = ""

    def _parse_members(self, html: str) -> list[dict]:
        """
        Parse all SportsOrganization member entries from the page JSON-LD.
        Returns the raw list of member dicts.
        """
        soup = BeautifulSoup(html, "html.parser")
        tags = soup.find_all(
            "script",
            attrs={"type": "application/ld+json", "data-next-head": ""},
        )

        for tag in tags:
            if not tag.string:
                continue
            try:
                data = json.loads(tag.string)
            except json.JSONDecodeError:
                continue

            if data.get("@type") == "SportsOrganization":
                self._org_name = data.get("name", "")
                return data.get("member") or []

        return []
