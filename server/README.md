# server

EliteProspects hockey data pipeline — scrapes organisation, team, player, and
stats data into MongoDB using a clean class-based Python package.

## Pipeline overview

```
Step 1  OrganizationScraper  →  league_members   (team URLs for a league)
Step 2  TeamScraper          →  teams            (full roster per team per year)
Step 3  PlayerScraper        →  players          (bio data per player)
Step 4  StatsScraper         →  stats            (per-season stats per player)
```

Each step reads from the previous step's collection and writes to its own.

---

## Project structure

```
server/                     ← project root
│
├── .env.example                ← copy to .env and fill in your values
├── .gitignore
├── pyproject.toml              ← package metadata + CLI entry-points
├── README.md
│
├── server/                 ← importable Python package
│   ├── __init__.py
│   ├── config.py               ← single source of truth for all settings
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   └── mongo.py            ← MongoRepository base class (upsert, index, find…)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── player.py           ← PlayerDocument dataclass
│   │   ├── stats.py            ← GoalieStats, SkaterStats, StatRow dataclasses
│   │   └── team.py             ← TeamDocument dataclass
│   │
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── base.py             ← BaseScraper (wires HTTP + DB + logging)
│   │   ├── organization.py     ← OrganizationScraper
│   │   ├── teams.py            ← TeamScraper
│   │   ├── players.py          ← PlayerScraper
│   │   └── stats.py            ← StatsScraper + LeagueTableParser
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── helpers.py          ← pure functions (year_to_season, normalise_url …)
│   │   ├── http.py             ← HttpClient (rate-limit retry, polite sleep)
│   │   └── logger.py           ← get_logger() factory (stdout + optional file)
│   │
│   └── scripts/
│       ├── __init__.py
│       ├── run_all.py          ← runs all 4 steps in order
│       ├── run_organizations.py
│       ├── run_teams.py
│       ├── run_players.py
│       └── run_stats.py
│
└── tests/
    ├── __init__.py
    ├── test_helpers.py         ← unit tests for pure utility functions
    ├── test_models.py          ← unit tests for dataclass models
    └── test_scrapers.py        ← scraper tests (mocked HTTP + MongoDB)
```

---

## Quick start

### 1 — Clone and create a virtual environment

```bash
git clone <your-repo-url>
cd server

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### 2 — Install the package

```bash
# Production dependencies only
pip install -e .

# Include dev/test dependencies
pip install -e ".[dev]"
```

### 3 — Configure environment variables

```bash
cp ../.env.example ../.env
```

Open `../.env` and set at minimum:

```env
MONGO_URI=mongodb://localhost:27017/
DB_NAME=elite_prospects_db
EP_LEAGUE_SLUG=ushs-prep
EP_TARGET_YEAR=2025
```

### 4 — Run the full pipeline

```bash
server-run-all
```

Or run individual steps:

```bash
server-organizations          # Step 1: populate league_members
server-teams                  # Step 2: populate teams
server-teams --year 2024      # specify a different year
server-teams --reset          # wipe teams and restart
server-players                # Step 3: populate players
server-stats                  # Step 4: populate stats
```

---

## Environment variables reference

| Variable                    | Default                        | Description                              |
|-----------------------------|--------------------------------|------------------------------------------|
| `MONGO_URI`                 | `mongodb://localhost:27017/`   | MongoDB connection string                |
| `DB_NAME`                   | `elite_prospects_db`           | Database name                            |
| `LEAGUE_MEMBERS_COLLECTION` | `league_members`               | Collection for org members               |
| `TEAMS_COLLECTION`          | `teams`                        | Collection for team rosters              |
| `PLAYERS_COLLECTION`        | `players`                      | Collection for player bios               |
| `STATS_COLLECTION`          | `stats`                        | Collection for per-season stats          |
| `EP_LEAGUE_SLUG`            | `ushs-prep`                    | EP league URL slug to scrape             |
| `EP_TARGET_YEAR`            | `2025`                         | Season start year (2025 → "2025-2026")   |
| `SCRAPE_DELAY_MIN`          | `1.5`                          | Min seconds between requests             |
| `SCRAPE_DELAY_MAX`          | `3.0`                          | Max seconds between requests             |
| `RATE_LIMIT_BACKOFF`        | `60`                           | Seconds to sleep on 403 per retry        |
| `MAX_RETRIES`               | `3`                            | HTTP retry attempts on error             |
| `REQUEST_TIMEOUT`           | `30`                           | HTTP timeout in seconds                  |
| `LOG_LEVEL`                 | `INFO`                         | `DEBUG` / `INFO` / `WARNING` / `ERROR`   |
| `LOG_FILE`                  | *(empty — stdout only)*        | Path to write log file                   |

---

## MongoDB collections

### `league_members`
One document per team in the league.

```json
{
  "url":                 "https://www.eliteprospects.com/team/5695/albany-academy",
  "name":                "Albany Academy",
  "@type":               "SportsTeam",
  "parent_organization": "USHS-Prep",
  "scraped":             true
}
```

### `teams`
One document per team per year.

```json
{
  "name":              "Albany Academy",
  "mainEntityOfPage":  "https://www.eliteprospects.com/team/5695/albany-academy",
  "year":              2025,
  "memberOf":          { "name": "USHS-Prep" },
  "athlete":           [ { "name": "Benjamin Art", "url": "https://..." } ],
  "source_member_id":  "ObjectId(...)",
  "updated_at":        "2026-..."
}
```

### `players`
One document per player per season year.

```json
{
  "url":            "https://www.eliteprospects.com/player/1114621/benjamin-art",
  "name":           "Benjamin Art",
  "birthDate":      "2010-07-29",
  "birthPlace":     { "name": "Williamstown, MA" },
  "nationality":    { "name": "USA" },
  "knowsAbout":     ["Ice hockey", "Goaltender", "USHS-Prep"],
  "year":           2025,
  "source_team_id": "ObjectId(...)",
  "updated_at":     "2026-..."
}
```

### `stats`
One document per player × season × league × stat_type.

```json
{
  "player_url":        "https://www.eliteprospects.com/player/1114621/...",
  "player_name":       "Benjamin Art",
  "player_id":         "1114621",
  "season":            "2025-2026",
  "league":            "ushs-prep",
  "team":              "Albany Academy",
  "position":          "G",
  "stat_type":         "REGULAR_SEASON",
  "stats": {
    "gp": 18, "w": 14, "l": 3, "ot": 1,
    "gaa": 1.82, "sv_pct": 93.1, "so": 2, "toi": "1080:00"
  },
  "source_team_id":    "ObjectId(...)",
  "source_player_id":  "ObjectId(...)",
  "scraped_at":        "2026-..."
}
```

---

## Running tests

```bash
pytest                          # all tests
pytest tests/test_helpers.py   # pure utility tests (no mocking needed)
pytest tests/test_models.py    # model dataclass tests
pytest tests/test_scrapers.py  # scraper tests (mocked HTTP + DB)
pytest -v --tb=short           # verbose with short tracebacks
```

---

## Using scrapers programmatically

```python
from server.scrapers import OrganizationScraper, TeamScraper, PlayerScraper, StatsScraper

# Run one step
OrganizationScraper().run()

# Run with custom year
TeamScraper(target_year=2024).run()

# Run all steps
for Scraper in [OrganizationScraper, TeamScraper, PlayerScraper, StatsScraper]:
    Scraper().run()
```

---

## Why the league page for stats?

EliteProspects loads player-level stats entirely client-side via Apollo/GraphQL.
`requests.get("/player/{id}/{slug}/stats")` returns an empty HTML shell.

The **league stats page** (`/league/{slug}/stats/{season}`) is server-side rendered
with real `<table>` elements containing all player stats. The scraper:

1. Fetches each paginated league stats page
2. Detects the correct table (goalie vs skater) by inspecting `<th>` headers
3. Extracts each player's `/player/` href link
4. Matches it against the lookup built from the `teams` collection
5. Upserts the result — no per-player HTTP calls needed

This is the same technique used by the
[TopDownHockey EP scraper](https://github.com/TopDownHockey/TopDownHockey_Scraper).
