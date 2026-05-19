"""
server/scrapers/stats.py
-----------------------------
StatsScraper
Reads the `teams` collection to build a player lookup, groups players by (league_slug, season_slug),
scrapes the EP league stats page (the only page with server-side rendered stat tables),
matches rows back to players by their /player/ href, and upserts into `stats`.

Source : teams + players collections
Target : stats collection

WHY THE LEAGUE PAGE?
/player/{id}/{slug}/stats → stats loaded CLIENT-SIDE via Apollo/GraphQL.
/league/{slug}/stats/{yr} → stats SERVER-SIDE rendered in real <table>.
"""

from __future__ import annotations
import re
import time
import random
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from server.config import settings
from server.db.mongo import MongoRepository
from server.models.stats import GoalieStats, SkaterStats, StatRow
from server.scrapers.base import BaseScraper
from server.utils.helpers import (
    extract_player_id,
    league_name_to_slug,
    normalise_url,
    year_to_season,
)

# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------
class TeamsRepository(MongoRepository):
    collection_name = settings.teams_collection

class PlayersRepository(MongoRepository):
    collection_name = settings.players_collection

class StatsRepository(MongoRepository):
    collection_name = settings.stats_collection

# ---------------------------------------------------------------------------
# HTML table parser (adapted from TopDownHockey EP scraper)
# ---------------------------------------------------------------------------
class LeagueTableParser:
    """Parses the EP league stats HTML page into raw stat rows."""
    EP_BASE = settings.ep_base_url

    @staticmethod
    def find_stats_table(soup: BeautifulSoup, kind: str):
        """Locate the correct <table> by inspecting <th> header text."""
        for table in soup.find_all("table"):
            headers = [th.get_text(strip=True).upper() for th in table.find_all("th")]
            if not headers:
                continue
            if kind == "goalie" and "GAA" in headers and "SV%" in headers:
                return table
            if kind == "skater" and "GP" in headers and (
                "TP" in headers or "PTS" in headers
            ):
                return table
        return None

    @staticmethod
    def table_to_rows(table) -> tuple[list[str], list[list[str]]]:
        """Return (headers, data_rows) from a BeautifulSoup <table>."""
        trs = table.find_all("tr")
        if not trs:
            return [], []
        headers = [th.get_text(strip=True) for th in trs[0].find_all("th")]
        if not headers:
            return [], []
        ncols = len(headers)
        rows = [
            [td.get_text(strip=True) for td in tr.find_all("td")]
            for tr in trs[1:]
        ]
        return headers, [r for r in rows if len(r) == ncols]

    @classmethod
    def extract_player_links(cls, table) -> list[str]:
        """Pull all full /player/ hrefs from anchor tags inside the table."""
        links = []
        for a in table.find_all("a", href=True):
            href = a["href"]
            if "/player/" in href:
                full = href if href.startswith("http") else cls.EP_BASE + href
                links.append(full.rstrip("/"))
        return links

    @classmethod
    def parse(
        cls, html: str, kind: str
    ) -> list[dict]:
        """
        Parse one HTML page and return a list of raw row dicts:
        { player_url, team_name, stats_dict }
        Returns empty list if no matching table is found (signals end of pagination).
        """
        soup = BeautifulSoup(html, "html.parser")
        table = cls.find_stats_table(soup, kind)
        if table is None:
            return []
        headers, data_rows = cls.table_to_rows(table)
        player_links = cls.extract_player_links(table)

        # Drop EP separator rows (empty '#' column)
        hash_col = "#" if "#" in headers else None
        valid_rows, valid_links = [], []
        link_cursor = 0
        for cells in data_rows:
            rd = dict(zip(headers, cells))
            if hash_col and rd.get(hash_col, "").strip() == "":
                continue
            valid_rows.append(cells)
            valid_links.append(
                player_links[link_cursor] if link_cursor < len(player_links) else None
            )
            link_cursor += 1

        results = []
        for i, cells in enumerate(valid_rows):
            rd = dict(zip(headers, cells))
            team_raw = rd.get("TEAM") or rd.get("Team") or ""
            team_name = team_raw.split("\u201c")[0].strip() or None

            if kind == "goalie":
                stats = GoalieStats.from_row(rd).to_dict()
            else:
                stats = SkaterStats.from_row(rd).to_dict()

            results.append({
                "player_url": valid_links[i],
                "team_name": team_name,
                "stats": stats,
            })
        return results

# ---------------------------------------------------------------------------
# StatsScraper
# ---------------------------------------------------------------------------
class StatsScraper(BaseScraper):
    """
    Scrapes EP league stats pages and populates the stats collection.
    Usage::
        scraper = StatsScraper()
        total = scraper.run()
    """
    def __init__(self) -> None:
        super().__init__(repo=StatsRepository())
        self._teams_repo = TeamsRepository()
        self._players_repo = PlayersRepository()
        self._parser = LeagueTableParser()

    # ------------------------------------------------------------------
    def run(self) -> int:
        # Ensure compound unique index exists
        with self.repo:
            self.repo.ensure_index(
                [("player_url", 1), ("season", 1), ("league", 1), ("stat_type", 1)],
                unique=True,
            )

        # Step 1: Build lookup maps from MongoDB
        with self._teams_repo:
            player_lookup = self._build_player_lookup()
        with self._players_repo:
            bio_lookup = self._build_bio_lookup()

        self.log.info(
            "%d unique player URLs found across all teams.", len(player_lookup)
        )

        # Step 2: Group by (league_slug, season_slug)
        groups = self._group_by_league_season(player_lookup)
        self.log.info("%d (league, season) combos to scrape.", len(groups))

        # Step 3: Scrape each combo
        total_upserted = 0
        with self.repo:
            with self.http:
                for combo_num, ((league_slug, season_slug), group_meta) in enumerate(
                    sorted(groups.items()), start=1
                ):
                    upserted = self._scrape_combo(
                        combo_num,
                        len(groups),
                        league_slug,
                        season_slug,
                        group_meta,
                        player_lookup,
                        bio_lookup,
                    )
                    total_upserted += upserted

                    # Polite delay between league combos
                    delay = random.uniform(2.0, 4.0)
                    self.log.debug("Sleeping %.1fs before next combo.", delay)
                    time.sleep(delay)

        self.log.info("StatsScraper finished. Total rows upserted: %d", total_upserted)
        return total_upserted

    # ------------------------------------------------------------------
    # Lookup builders
    # ------------------------------------------------------------------
    def _build_player_lookup(self) -> dict[str, dict]:
        """
        Build: normalised_player_url → { player_name, team_name, team_doc_id, league_slug, season_slug, position_hint }
        """
        lookup: dict[str, dict] = {}
        for team_doc in self._teams_repo.find({"athlete": {"$exists": True}}):
            team_name = team_doc.get("name", "Unknown Team")
            team_doc_id = team_doc.get("_id")
            year = team_doc.get("year")
            member_of = team_doc.get("memberOf") or {}
            league_name = (
                member_of.get("name", "") if isinstance(member_of, dict) else ""
            )

            athletes = team_doc.get("athlete") or []
            if isinstance(athletes, dict):
                athletes = [athletes]

            for athlete in athletes:
                if not isinstance(athlete, dict):
                    continue
                raw_url = athlete.get("url", "").rstrip("/")
                if not raw_url:
                    continue
                norm_url = normalise_url(raw_url)
                
                # Hardened position matching for variations like 'Goalie', 'Goaltender', 'G'
                at_lower = athlete.get("@type", "").lower()
                position = (
                    "G" if any(x in at_lower for x in ["goal", "gk", "g"]) else "F/D"
                )

                lookup[norm_url] = {
                    "player_name": athlete.get("name", "Unknown"),
                    "team_name": team_name,
                    "team_doc_id": team_doc_id,
                    "league_slug": league_name_to_slug(league_name),
                    "season_slug": year_to_season(year) if year else None,
                    "position_hint": position,
                }
        return lookup

    def _build_bio_lookup(self) -> dict[str, dict]:
        """Build: normalised_player_url → players collection doc."""
        lookup: dict[str, dict] = {}
        for pdoc in self._players_repo.find(
            {"url": {"$exists": True}},
            {"url": 1, "name": 1, "_id": 1},
        ):
            norm = normalise_url(pdoc.get("url", ""))
            if norm:
                lookup[norm] = pdoc
        return lookup

    # ------------------------------------------------------------------
    # Grouping
    # ------------------------------------------------------------------
    @staticmethod
    def _group_by_league_season(player_lookup: dict) -> dict[tuple, dict]:
        groups: dict[tuple, dict] = {}
        for norm_url, meta in player_lookup.items():
            ls = meta.get("league_slug")
            ss = meta.get("season_slug")
            if not ls or not ss:
                continue
            key = (ls, ss)
            if key not in groups:
                groups[key] = {
                    "player_urls": set(),
                    "has_goalie": False,
                    "has_skater": False,
                }
            groups[key]["player_urls"].add(norm_url)
            if meta["position_hint"] == "G":
                groups[key]["has_goalie"] = True
            else:
                groups[key]["has_skater"] = True
        return groups

    # ------------------------------------------------------------------
    # Scraping one league/season combo
    # ------------------------------------------------------------------
    def _scrape_combo(
        self,
        combo_num: int,
        total_combos: int,
        league_slug: str,
        season_slug: str,
        group_meta: dict,
        player_lookup: dict,
        bio_lookup: dict,
    ) -> int:
        group_urls = group_meta["player_urls"]

        # Skip if all players already stored
        already_done = sum(
            1 for u in group_urls
            if self.repo.count(
                {"player_url": u, "season": season_slug, "league": league_slug}
            ) > 0
        )
        if already_done == len(group_urls):
            self.log.info(
                "[%d/%d] SKIP (all %d done): %s %s",
                combo_num,
                total_combos,
                len(group_urls),
                league_slug,
                season_slug,
            )
            return 0

        kinds = []
        if group_meta["has_goalie"]:
            kinds.append("goalie")
        if group_meta["has_skater"]:
            kinds.append("skater")

        self.log.info(
            "[%d/%d] %s %s — %d players — scraping %s",
            combo_num,
            total_combos,
            league_slug.upper(),
            season_slug,
            len(group_urls),
            kinds,
        )

        total = 0
        for kind in kinds:
            total += self._scrape_kind(
                league_slug, season_slug, kind, player_lookup, bio_lookup
            )
        return total

    def _scrape_kind(
        self,
        league_slug: str,
        season_slug: str,
        kind: str,
        player_lookup: dict,
        bio_lookup: dict,
    ) -> int:
        # Fixed: Explicitly branch on clean query parameter strings
        if kind == "goalie":
            base = f"{self.cfg.ep_base_url}/league/{league_slug}/stats/{season_slug}?tab=goalies&page="
        else:
            base = f"{self.cfg.ep_base_url}/league/{league_slug}/stats/{season_slug}?page="

        self.log.info("  Fetching %s stats …", kind)
        upserted = unmatched = 0

        for page_num in range(1, 99):
            url = base + str(page_num)
            html = self.http.get(url)
            if not html:
                self.log.debug("  No response on page %d — stopping.", page_num)
                break

            rows = self._parser.parse(html, kind)
            if not rows:
                self.log.debug("  No %s table on page %d — stopping.", kind, page_num)
                break

            self.log.debug("  Page %d: %d rows", page_num, len(rows))

            for raw_row in rows:
                player_url = normalise_url(raw_row.get("player_url") or "")
                if not player_url:
                    unmatched += 1
                    continue

                meta = player_lookup.get(player_url)
                if not meta:
                    unmatched += 1
                    continue

                bio = bio_lookup.get(player_url, {})

                stat_row = StatRow(
                    player_url=player_url,
                    player_name=meta["player_name"],
                    player_id=extract_player_id(player_url),
                    season=season_slug,
                    league=league_slug,
                    team=raw_row.get("team_name") or meta["team_name"],
                    position="G" if kind == "goalie" else "F/D",
                    stat_type="REGULAR_SEASON",
                    stats=raw_row.get("stats", {}),
                    source_team_id=meta["team_doc_id"],
                    source_player_id=bio.get("_id"),
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                )

                self.repo.upsert(stat_row.upsert_filter, stat_row.to_dict())
                upserted += 1

            time.sleep(random.uniform(1.5, 3.0))

        self.log.info(
            "  %s: upserted=%d unmatched=%d", kind.capitalize(), upserted, unmatched
        )
        return upserted
