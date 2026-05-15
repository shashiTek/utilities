"""
Scraper unit tests.
Uses 'responses' to mock HTTP calls and 'mongomock' for MongoDB.
Run with:  pytest tests/test_scrapers.py -v
"""

import json
import pytest
import responses as resp_lib
import mongomock

from unittest.mock import patch, MagicMock
from ep_scraper.scrapers.organization import OrganizationScraper
from ep_scraper.scrapers.stats import LeagueTableParser


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

LEAGUE_URL = "https://www.eliteprospects.com/league/ushs-prep"

ORG_HTML = """
<html><head></head><body>
<script type="application/ld+json" data-next-head="">
{
  "@type": "SportsOrganization",
  "name": "USHS-Prep",
  "member": [
    {"@type": "SportsTeam", "name": "Albany Academy",
     "url": "https://www.eliteprospects.com/team/5695/albany-academy"},
    {"@type": "SportsTeam", "name": "Exeter",
     "url": "https://www.eliteprospects.com/team/111/exeter"}
  ]
}
</script>
</body></html>
"""

GOALIE_TABLE_HTML = """
<html><body>
<table>
  <tr><th>#</th><th>Player</th><th>Team</th><th>GP</th><th>W</th>
      <th>L</th><th>OT</th><th>GAA</th><th>SV%</th><th>SO</th><th>MIN</th></tr>
  <tr><td>1</td>
      <td><a href="/player/1114621/benjamin-art">Benjamin Art</a></td>
      <td>Albany Academy</td>
      <td>18</td><td>14</td><td>3</td><td>1</td>
      <td>1.82</td><td>93.1</td><td>2</td><td>1080:00</td></tr>
</table>
</body></html>
"""

SKATER_TABLE_HTML = """
<html><body>
<table>
  <tr><th>#</th><th>Player</th><th>Team</th>
      <th>GP</th><th>G</th><th>A</th><th>TP</th><th>+/-</th><th>PIM</th></tr>
  <tr><td>1</td>
      <td><a href="/player/9999/carter-holt">Carter Holt</a></td>
      <td>Albany Academy</td>
      <td>24</td><td>14</td><td>18</td><td>32</td><td>12</td><td>20</td></tr>
</table>
</body></html>
"""

EMPTY_PAGE_HTML = "<html><body><p>No data</p></body></html>"


# ---------------------------------------------------------------------------
# OrganizationScraper tests
# ---------------------------------------------------------------------------

class TestOrganizationScraper:

    @resp_lib.activate
    def test_run_upserts_members(self):
        resp_lib.add(resp_lib.GET, LEAGUE_URL, body=ORG_HTML, status=200)

        scraper = OrganizationScraper()
        # Patch the repo to avoid real MongoDB
        mock_col = MagicMock()
        mock_col.update_one.return_value = MagicMock(upserted_id="abc", modified_count=0)
        scraper.repo._collection = mock_col
        scraper.repo._client = MagicMock()

        with patch.object(scraper.repo, "connect"):
            with patch.object(scraper.repo, "disconnect"):
                count = scraper.run()

        assert count == 2
        assert mock_col.update_one.call_count == 2

    @resp_lib.activate
    def test_run_handles_404(self):
        resp_lib.add(resp_lib.GET, LEAGUE_URL, status=404)

        scraper = OrganizationScraper()
        count = scraper.run()
        assert count == 0

    @resp_lib.activate
    def test_run_handles_no_org_tag(self):
        resp_lib.add(resp_lib.GET, LEAGUE_URL,
                     body="<html><body>no json</body></html>", status=200)
        scraper = OrganizationScraper()
        count = scraper.run()
        assert count == 0


# ---------------------------------------------------------------------------
# LeagueTableParser tests
# ---------------------------------------------------------------------------

class TestLeagueTableParser:

    def test_parse_goalie_table(self):
        rows = LeagueTableParser.parse(GOALIE_TABLE_HTML, "goalie")
        assert len(rows) == 1
        row = rows[0]
        assert "benjamin-art" in row["player_url"]
        assert row["stats"]["gp"]     == 18
        assert row["stats"]["w"]      == 14
        assert row["stats"]["gaa"]    == pytest.approx(1.82)
        assert row["stats"]["sv_pct"] == pytest.approx(93.1)
        assert row["stats"]["toi"]    == "1080:00"

    def test_parse_skater_table(self):
        rows = LeagueTableParser.parse(SKATER_TABLE_HTML, "skater")
        assert len(rows) == 1
        row = rows[0]
        assert "carter-holt" in row["player_url"]
        assert row["stats"]["gp"]  == 24
        assert row["stats"]["g"]   == 14
        assert row["stats"]["pts"] == 32

    def test_parse_empty_page_returns_empty(self):
        rows = LeagueTableParser.parse(EMPTY_PAGE_HTML, "goalie")
        assert rows == []

    def test_parse_wrong_kind_returns_empty(self):
        # Ask for skater table but page has goalie table
        rows = LeagueTableParser.parse(GOALIE_TABLE_HTML, "skater")
        assert rows == []
