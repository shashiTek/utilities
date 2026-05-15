"""
player_stats.py
---------------
Scrapes per-season stats for every player in your MongoDB pipeline by:

  1. Reading the `teams` collection (populated by teams.py) to get the full
     roster, league, and season for every team.
  2. Grouping players by (league_slug, season_slug) to minimise HTTP requests.
  3. Scraping the EliteProspects LEAGUE stats page — the only EP page that
     serves stats in real server-rendered HTML tables.
  4. Matching each table row back to a player using the /player/ href link.
  5. Upserting the result into a `stats` collection.

DATA PIPELINE CONTEXT
---------------------
organization.py  →  league_members  (team URLs for a given league)
teams.py         →  teams            (full roster per team per year)
players.py       →  players          (bio data per player per year)
player_stats.py  →  stats            (season stats per player)  ← THIS SCRIPT

WHY WE USE THE LEAGUE PAGE (not the player page)
-------------------------------------------------
The player profile page  (/player/{id}/{slug})
The player stats subpage (/player/{id}/{slug}/stats)
  → Both load stats via Apollo/GraphQL CLIENT-SIDE only.
  → requests.get() gets empty "No Data Found" placeholder HTML.

The LEAGUE stats page (/league/{slug}/stats/{season})
  → Stats are SERVER-SIDE rendered in real <table> elements with <th> headers.
  → This is the same technique used by the TopDownHockey EP scraper on GitHub.

TEAMS COLLECTION STRUCTURE (written by teams.py)
-------------------------------------------------
{
  "name"             : "Albany Academy",
  "mainEntityOfPage" : "https://www.eliteprospects.com/team/5695/albany-academy",
  "year"             : 2025,                          ← TARGET_YEAR from teams.py
  "memberOf"         : { "name": "USHS-Prep" },       ← league name
  "athlete"          : [                              ← roster
    { "name": "Benjamin Art",
      "url" : "https://www.eliteprospects.com/player/1114621/benjamin-art" },
    ...
  ],
  "source_member_id" : ObjectId("..."),
  "updated_at"       : datetime
}

SEASON SLUG DERIVATION
-----------------------
teams.year = 2025  →  season_slug = "2025-2026"   (year starts in fall)
teams.year = 2024  →  season_slug = "2024-2025"

USAGE
-----
    pip install pymongo beautifulsoup4 requests

    python player_stats.py

ENVIRONMENT VARIABLES
---------------------
    MONGO_URI           (default: mongodb://nyxsvlalb697:27017/)
    DB_NAME             (default: elite_prospects_db)
    TEAMS_COLLECTION    (default: teams)
    PLAYERS_COLLECTION  (default: players)   ← used for name enrichment only
    STATS_COLLECTION    (default: stats)
"""

import os
import re
import time
import random
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MONGO_URI          = os.getenv("MONGO_URI",          "mongodb://nyxsvlalb697:27017/")
DB_NAME            = os.getenv("DB_NAME",            "elite_prospects_db")
TEAMS_COLLECTION   = os.getenv("TEAMS_COLLECTION",   "teams")
PLAYERS_COLLECTION = os.getenv("PLAYERS_COLLECTION", "players")
STATS_COLLECTION   = os.getenv("STATS_COLLECTION",   "stats")

EP_BASE = "https://www.eliteprospects.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ---------------------------------------------------------------------------
# Season slug helper
# ---------------------------------------------------------------------------

def year_to_season(year: int) -> str:
    """
    Convert teams.py TARGET_YEAR integer to an EP season slug string.
    e.g.  2025  →  "2025-2026"
          2024  →  "2024-2025"
    """
    return f"{year}-{year + 1}"


def league_name_to_slug(name: str) -> str:
    """
    Convert a human-readable league name to the EP URL slug.
    e.g.  "USHS-Prep"  →  "ushs-prep"
          "OHL"         →  "ohl"
          "NCAA D-I"    →  "ncaa-d-i"
    """
    return name.lower().replace(" ", "-") if name else ""


# ---------------------------------------------------------------------------
# HTML table helpers  (adapted from TopDownHockey EP scraper)
# ---------------------------------------------------------------------------

def find_stats_table(soup: BeautifulSoup, kind: str):
    """
    Locate the correct stats table by inspecting <th> header content.
    kind: "goalie" or "skater"
    """
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).upper() for th in table.find_all("th")]
        if not headers:
            continue
        if kind == "goalie" and "GAA" in headers and "SV%" in headers:
            return table
        if kind == "skater" and "GP" in headers and ("TP" in headers or "PTS" in headers):
            return table
    return None


def table_to_rows(table) -> tuple[list[str], list[list[str]]]:
    """Return (headers, data_rows) from a <table>."""
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


def extract_player_links(table) -> list[str]:
    """Pull all full player URLs from <a href="/player/..."> in the table."""
    links = []
    for a in table.find_all("a", href=True):
        href = a["href"]
        if "/player/" in href:
            full = href if href.startswith("http") else EP_BASE + href
            links.append(full.rstrip("/"))
    return links


# ---------------------------------------------------------------------------
# Stat row parsers
# ---------------------------------------------------------------------------

def _i(val: str):
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return None


def _f(val: str):
    try:
        return float(str(val).strip().replace("%", ""))
    except (ValueError, TypeError):
        return None


def parse_goalie_row(headers: list[str], cells: list[str]) -> dict:
    r = dict(zip(headers, cells))
    return {
        "gp":     _i(r.get("GP",  "")),
        "w":      _i(r.get("W",   "")),
        "l":      _i(r.get("L",   "")),
        "ot":     _i(r.get("OT",  "")),
        "gaa":    _f(r.get("GAA", "")),
        "sv_pct": _f(r.get("SV%", "")),
        "so":     _i(r.get("SO",  "")),
        "toi":    r.get("MIN") or r.get("TOI") or r.get("MINS"),
    }


def parse_skater_row(headers: list[str], cells: list[str]) -> dict:
    r = dict(zip(headers, cells))
    return {
        "gp":         _i(r.get("GP",  "")),
        "g":          _i(r.get("G",   "")),
        "a":          _i(r.get("A",   "")),
        "pts":        _i(r.get("TP",  "") or r.get("PTS", "")),
        "plus_minus": _i(r.get("+/-", "") or r.get("PM",  "")),
        "pim":        _i(r.get("PIM", "")),
        "ppg":        _i(r.get("PPG", "")),
        "shg":        _i(r.get("SHG", "")),
    }


# ---------------------------------------------------------------------------
# League stats page scraper
# ---------------------------------------------------------------------------

def fetch_html(url: str, session: requests.Session) -> str | None:
    """
    Fetch a URL with 403-aware retry.
    EP rate-limits hard — on 403 we sleep 60 s then retry (same as TopDownHockey).
    """
    for attempt in range(1, 4):
        try:
            resp = session.get(url, headers=HEADERS, timeout=30)

            if resp.status_code == 403:
                wait = 60 * attempt
                print(f"    [403] Rate limited. Sleeping {wait}s (attempt {attempt}/3)...")
                time.sleep(wait)
                continue

            if resp.status_code == 404:
                return None          # League/season combo doesn't exist

            resp.raise_for_status()
            return resp.text

        except requests.exceptions.RequestException as e:
            print(f"    [NET] Attempt {attempt}/3: {e}")
            time.sleep(5 * attempt)

    return None


def scrape_league_stats_page(
    league_slug: str,
    season_slug: str,
    kind: str,
    session: requests.Session,
) -> list[dict]:
    """
    Scrape all pages of a league stats table.
    Returns a list of raw rows: { player_url, stats{}, team_name }
    """
    if kind == "goalie":
        base = f"{EP_BASE}/league/{league_slug}/stats/{season_slug}?tab=goalies&page="
    else:
        base = f"{EP_BASE}/league/{league_slug}/stats/{season_slug}?page="

    all_rows = []

    for page_num in range(1, 99):
        url  = base + str(page_num)
        html = fetch_html(url, session)

        if html is None:
            print(f"    No response on page {page_num}. Stopping.")
            break

        soup  = BeautifulSoup(html, "html.parser")
        table = find_stats_table(soup, kind)

        if table is None:
            print(f"    No {kind} table on page {page_num}. Stopping.")
            break

        headers, data_rows = table_to_rows(table)
        player_links       = extract_player_links(table)

        # Drop empty '#' rows (EP separator rows)
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

        if not valid_rows:
            print(f"    Empty page {page_num}. Stopping.")
            break

        print(f"    Page {page_num}: {len(valid_rows)} rows")

        for i, cells in enumerate(valid_rows):
            rd = dict(zip(headers, cells))
            # EP sometimes puts team in a "TEAM" column, sometimes splits with "
            team_raw = rd.get("TEAM") or rd.get("Team") or ""
            team_name = team_raw.split("\u201c")[0].strip() or None

            stats = (
                parse_goalie_row(headers, cells)
                if kind == "goalie"
                else parse_skater_row(headers, cells)
            )

            all_rows.append({
                "player_url": valid_links[i],
                "stats":      stats,
                "team_name":  team_name,
            })

        time.sleep(random.uniform(1.5, 3.0))

    return all_rows


# ---------------------------------------------------------------------------
# Build player lookup from the teams collection
# ---------------------------------------------------------------------------

def build_player_lookup(teams_col, players_col) -> dict[str, dict]:
    """
    Iterate every team document and build a flat lookup:
        normalised_player_url  →  {
            player_name, team_name, team_doc_id,
            league_slug, season_slug, position_hint
        }

    The teams collection stores:
        doc.athlete  = [{ name, url, @type }, ...]
        doc.memberOf = { name: "USHS-Prep" }
        doc.year     = 2025
        doc.name     = "Albany Academy"
        doc._id      = ObjectId(...)
    """
    # 1. Cache the players collection
    player_db_cache = {}
    for p_doc in players_col.find({"url": {"$exists": True}}):
        p_url = p_doc.get("url", "").rstrip("/")
        if p_url:
            norm_p_url = p_url if p_url.startswith("http") else EP_BASE + p_url
            player_db_cache[norm_p_url] = p_doc

    lookup: dict[str, dict] = {}

    for team_doc in teams_col.find({"athlete": {"$exists": True}}):
        team_name    = team_doc.get("name", "Unknown Team")
        team_doc_id  = team_doc.get("_id")
        year         = team_doc.get("year")
        member_of    = team_doc.get("memberOf") or {}
        league_name  = member_of.get("name", "") if isinstance(member_of, dict) else ""
        league_slug  = league_name_to_slug(league_name)
        season_slug  = year_to_season(year) if year else None

        athletes = team_doc.get("athlete") or []
        if isinstance(athletes, dict):        # EP sometimes returns a single object
            athletes = [athletes]

        for athlete in athletes:
            if not isinstance(athlete, dict):
                continue
            raw_url = athlete.get("url", "").rstrip("/")
            if not raw_url:
                continue
            norm_url = raw_url if raw_url.startswith("http") else EP_BASE + raw_url

            # Detect goalie from @type or name hints
            # 3. Determine player type string
            at = None
            if norm_url in player_db_cache:
                p_doc = player_db_cache[norm_url]
                know_about = p_doc.get("knowsAbout")
                
                # Verify safe indexing of array[1]
                if isinstance(know_about, list) and len(know_about) > 1:
                    type_hint = know_about[1]
                    if type_hint=="Goalkeeper":
                        at = "G"
                    if type_hint=="Defender":
                        at = "D"
                    if type_hint=="Forward":
                        at = "F"
                    
            position_hint = "F/D" if at is None else at

            lookup[norm_url] = {
                "player_name":   athlete.get("name", "Unknown"),
                "team_name":     team_name,
                "team_doc_id":   team_doc_id,
                "league_slug":   league_slug,
                "season_slug":   season_slug,
                "position_hint": position_hint,
            }

    return lookup


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_stats():
    client = None
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        print(f"[INFO] Connected to MongoDB at {MONGO_URI}")
    except PyMongoError as e:
        print(f"[ERROR] Cannot connect to MongoDB: {e}")
        return

    try:
        db          = client[DB_NAME]
        teams_col   = db[TEAMS_COLLECTION]
        players_col = db[PLAYERS_COLLECTION]
        stats_col   = db[STATS_COLLECTION]

        # Compound unique index: one doc per player × season × league × stat_type
        stats_col.create_index(
            [("player_url", 1), ("season", 1), ("league", 1), ("stat_type", 1)],
            unique=True,
            background=True,
        )

        # ----------------------------------------------------------------
        # Step 1 — Build player lookup from teams collection
        # ----------------------------------------------------------------
        print(f"\n[INFO] Building player lookup from '{TEAMS_COLLECTION}' ...")
        player_lookup = build_player_lookup(teams_col, players_col=players_col)
        print(f"[INFO] {len(player_lookup)} unique player URLs found across all teams.")

        # Also load players collection for enriched bio data (optional join)
        bio_lookup: dict[str, dict] = {}
        for pdoc in players_col.find(
            {"url": {"$exists": True}},
            {"url": 1, "name": 1, "knowsAbout": 1, "_id": 1}
        ):
            norm = (pdoc.get("url") or "").rstrip("/")
            if norm:
                bio_lookup[norm] = pdoc

        # ----------------------------------------------------------------
        # Step 2 — Group by (league_slug, season_slug) to batch scraping
        # ----------------------------------------------------------------
        groups: dict[tuple, dict] = {}   # (league_slug, season_slug) → metadata

        for norm_url, meta in player_lookup.items():
            league_slug = meta.get("league_slug")
            season_slug = meta.get("season_slug")

            if not league_slug or not season_slug:
                continue

            key = (league_slug, season_slug)
            if key not in groups:
                groups[key] = {
                    "player_urls": set(),
                    "has_goalie":  False,
                    "has_skater":  False,
                }
            groups[key]["player_urls"].add(norm_url)
            

            if meta.get("position_hint") == "G":
                groups[key]["has_goalie"] = True
            else:
                groups[key]["has_skater"] = True

        print(f"[INFO] {len(groups)} unique (league, season) combos to scrape.\n")

        # ----------------------------------------------------------------
        # Step 3 — Scrape each league/season combo
        # ----------------------------------------------------------------
        session        = requests.Session()
        total_upserted = 0
        combo_num      = 0

        for (league_slug, season_slug), group_meta in sorted(groups.items()):
            combo_num += 1
            group_urls = group_meta["player_urls"]

            # Skip if all players in this group already have stats stored
            already_done = sum(
                1 for u in group_urls
                if stats_col.count_documents(
                    {"player_url": u, "season": season_slug, "league": league_slug}
                ) > 0
            )
            if already_done == len(group_urls):
                print(
                    f"[{combo_num}/{len(groups)}] SKIP — all {len(group_urls)} players "
                    f"already stored: {league_slug} {season_slug}"
                )
                continue

            # Scrape both goalie and skater tables as needed
            kinds_to_scrape = []
            if group_meta["has_goalie"]:
                kinds_to_scrape.append("goalie")
            if group_meta["has_skater"]:
                kinds_to_scrape.append("skater")

            print(
                f"\n[{combo_num}/{len(groups)}] {league_slug.upper()} {season_slug} "
                f"— {len(group_urls)} players, scraping: {kinds_to_scrape}"
            )

            for kind in kinds_to_scrape:
                print(f"  Fetching {kind} stats ...")
                league_rows = scrape_league_stats_page(
                    league_slug, season_slug, kind, session
                )
                print(f"  Total rows from league page: {len(league_rows)}")

                upserted  = 0
                unmatched = 0

                for row in league_rows:
                    player_url = (row.get("player_url") or "").rstrip("/")
                    if not player_url:
                        unmatched += 1
                        continue

                    meta = player_lookup.get(player_url)
                    if not meta:
                        # Not one of our tracked players — skip
                        unmatched += 1
                        continue

                    # Enrich with bio data if available
                    bio = bio_lookup.get(player_url, {})

                    doc = {
                        "player_url":     player_url,
                        "player_name":    meta["player_name"],
                        "player_id":      (
                            re.search(r"/player/(\d+)/", player_url).group(1)
                            if re.search(r"/player/(\d+)/", player_url) else None
                        ),
                        "season":         season_slug,
                        "league":         league_slug,
                        # team from the stats table row (may differ from roster team
                        # if player transferred mid-season)
                        "team":           row.get("team_name") or meta["team_name"],
                        "position":       meta["position_hint"],
                        "stat_type":      "REGULAR_SEASON",
                        "stats":          row.get("stats", {}),
                        # Cross-references
                        "source_team_id": meta["team_doc_id"],
                        "source_player_id": bio.get("_id"),
                        "scraped_at":     datetime.now(timezone.utc).isoformat(),
                    }

                    try:
                        stats_col.update_one(
                            {
                                "player_url": doc["player_url"],
                                "season":     doc["season"],
                                "league":     doc["league"],
                                "stat_type":  doc["stat_type"],
                            },
                            {"$set": doc},
                            upsert=True,
                        )
                        upserted += 1
                    except PyMongoError as e:
                        print(f"    [DB ERR] {doc.get('player_name')} {season_slug}: {e}")

                print(
                    f"  {kind.capitalize()}s → upserted: {upserted} | "
                    f"unmatched (not our players): {unmatched}"
                )
                total_upserted += upserted

            # Delay between league combos
            sleep_sec = random.uniform(2.0, 4.0)
            print(f"  Sleeping {sleep_sec:.1f}s before next league ...")
            time.sleep(sleep_sec)

        print(f"\n[DONE] Total stat rows upserted this run: {total_upserted}")

    except PyMongoError as e:
        print(f"[ERROR] Pipeline error: {e}")
    finally:
        client.close()
        print("[INFO] MongoDB connection closed.")


if __name__ == "__main__":
    process_stats()
