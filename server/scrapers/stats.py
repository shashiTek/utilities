"""
server/scrapers/stats.py
-----------------------------
StatsScraper
Reads the `teams` collection to build a player lookup, groups players by (league_slug, season_slug),
scrapes the EP league stats page (the only page with server-side rendered stat tables),
matches rows back to players by their /player/ href, and upserts into `stats`.
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
# HTML table parser
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
        
        # Use first tr element to securely isolate the collection columns
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
    def parse(cls, html: str, kind: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        table = cls.find_stats_table(soup, kind)
        if table is None:
            return []
        headers, data_rows = cls.table_to_rows(table)
        player_links = cls.extract_player_links(table)

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
    def __init__(self) -> None:
        super().__init__(repo=StatsRepository())
        self._teams_repo = TeamsRepository()
        self._players_repo = PlayersRepository()
        self._parser = LeagueTableParser()

    def run(self) -> int:
        with self.repo:
            self.repo.ensure_index(
                [("player_url", 1), ("season", 1), ("league", 1), ("stat_type", 1)],
                unique=True,
            )

        player_lookup = self._build_player_lookup()
        
        with self._players_repo:
            bio_lookup = self._build_bio_lookup()

        self.log.info("%d unique player URLs found across all teams.", len(player_lookup))
        groups = self._group_by_league_season(player_lookup)
        self.log.info("%d (league, season) combos to scrape.", len(groups))

        total_upserted = 0
        with self.repo:
            with self.http:
                for combo_num, ((league_slug, season_slug), group_meta) in enumerate(
                    sorted(groups.items()), start=1
                ):
                    upserted = self._scrape_combo(
                        combo_num, len(groups), league_slug, season_slug, group_meta, player_lookup, bio_lookup
                    )
                    total_upserted += upserted
                    time.sleep(random.uniform(2.0, 4.0))

        self.log.info("StatsScraper finished. Total rows upserted: %d", total_upserted)
        return total_upserted

    def _build_player_lookup(self) -> dict[str, dict]:
        EP_BASE = self.cfg.ep_base_url
        """
        Build: normalised_player_url → { player_name, team_name, team_doc_id, league_slug, season_slug, position_hint }
        """
        player_db_cache = {}
        
        with self._players_repo:
            for p_doc in self._players_repo.find({"url": {"$exists": True}}):
                p_url = p_doc.get("url", "")
                if p_url:
                    # Fix: Use standard normalise_url utility for cache keys
                    norm_p_url = normalise_url(p_url)
                    player_db_cache[norm_p_url] = p_doc

        lookup: dict[str, dict] = {}
        
        with self._teams_repo:
            for team_doc in self._teams_repo.find({"athlete": {"$exists": True}}):
                team_name = team_doc.get("name", "Unknown Team")
                team_doc_id = team_doc.get("_id")
                year = team_doc.get("year")
                member_of = team_doc.get("memberOf") or {}
                league_slug = league_name_to_slug(member_of.get("name", "") if isinstance(member_of, dict) else "")
                season_slug = year_to_season(year) if year else None

                athletes = team_doc.get("athlete") or []
                if isinstance(athletes, dict):
                    athletes = [athletes]

                for athlete in athletes:
                    if not isinstance(athlete, dict):
                        continue
                    raw_url = athlete.get("url", "").rstrip("/")
                    if not raw_url:
                        continue
                    norm_url = raw_url

                    # Default fallback position
                    position_hint = "F/D" 
                    
                    if norm_url in player_db_cache:
                        p_doc = player_db_cache[norm_url]
                        know_about = p_doc.get("knowsAbout")
                        print(f"Player {athlete.get('name', 'Unknown')} has knowsAbout: {know_about}")
                        # FIX 1: Explicitly target index 1 to isolate position names
                        if isinstance(know_about, list) and len(know_about) > 1:
                            type_hint = know_about[1]
                            if type_hint == "Goalkeeper" or type_hint == "Goaltender":
                                position_hint = "G"
                                print(f"Identified goalie position for player {athlete.get('name', 'Unknown')}")
                            elif type_hint == "Defender":
                                position_hint = "D"
                            elif type_hint == "Forward":
                                position_hint = "F"
                            elif type_hint == "Center":
                                position_hint = "C"

                    lookup[norm_url] = {
                        "player_name": athlete.get("name", "Unknown"),
                        "team_name": team_name,
                        "team_doc_id": team_doc_id,
                        "league_slug": league_slug,
                        "season_slug": season_slug,
                        "position_hint": position_hint,
                    }
        return lookup

    def _build_bio_lookup(self) -> dict[str, dict]:
        lookup: dict[str, dict] = {}
        for pdoc in self._players_repo.find({"url": {"$exists": True}}, {"url": 1, "name": 1, "_id": 1}):
            norm = normalise_url(pdoc.get("url", ""))
            if norm:
                lookup[norm] = pdoc
        return lookup

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
            # Enables Goalie scraping branches dynamically if any single goalie belongs to the group
            if meta["position_hint"] == "G":
                print(f"Processing player {meta['player_name']} in league {ls} season {ss} with position hint {meta['position_hint']}")
                groups[key]["has_goalie"] = True
            else:
                groups[key]["has_skater"] = True
        return groups

    def _scrape_combo(self, combo_num: int, total_combos: int, league_slug: str, season_slug: str, group_meta: dict, player_lookup: dict, bio_lookup: dict) -> int:
        group_urls = group_meta["player_urls"]
        kinds = []
        if group_meta["has_goalie"]:
            kinds.append("goalie")
        if group_meta["has_skater"]:
            kinds.append("skater")

        self.log.info("[%d/%d] %s %s — %d players — scraping %s", combo_num, total_combos, league_slug.upper(), season_slug, len(group_urls), kinds)

        total = 0
        for kind in kinds:
            total += self._scrape_kind(league_slug, season_slug, kind, player_lookup, bio_lookup)
        return total

    def _scrape_kind(self, league_slug: str, season_slug: str, kind: str, player_lookup: dict, bio_lookup: dict) -> int:
        if kind == "goalie":
            base = f"{self.cfg.ep_base_url}/league/{league_slug}/stats/{season_slug}?tab=goalies&page="
        else:
            base = f"{self.cfg.ep_base_url}/league/{league_slug}/stats/{season_slug}?page="

        self.log.info("  Fetching %s stats …", kind)
        upserted = 0

        for page_num in range(1, 99):
            url = base + str(page_num)
            html = self.http.get(url)
            if not html:
                break

            rows = self._parser.parse(html, kind)
            if not rows:
                break

            for raw_row in rows:
                player_url = normalise_url(raw_row.get("player_url") or "")
                meta = player_lookup.get(player_url)
                if not meta:
                    continue

                bio = bio_lookup.get(player_url, {})

                # FIX 2: Bind the precise lookup field configuration ("G", "D", "F") to the document object
                stat_row = StatRow(
                    player_url=player_url,
                    player_name=meta["player_name"],
                    player_id=extract_player_id(player_url),
                    season=season_slug,
                    league=league_slug,
                    team=raw_row.get("team_name") or meta["team_name"],
                    position=meta["position_hint"], 
                    stat_type="REGULAR_SEASON",
                    stats=raw_row.get("stats", {}),
                    source_team_id=meta["team_doc_id"],
                    source_player_id=bio.get("_id"),
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                )

                self.repo.upsert(stat_row.upsert_filter, stat_row.to_dict())
                upserted += 1

            time.sleep(random.uniform(1.5, 3.0))
        return upserted
