"""Tests for model dataclasses."""

import pytest
from ep_scraper.models.stats import GoalieStats, SkaterStats, StatRow
from ep_scraper.models.player import PlayerDocument


class TestGoalieStats:
    RAW = {"GP": "18", "W": "14", "L": "3", "OT": "1",
           "GAA": "1.82", "SV%": "93.1", "SO": "2", "MIN": "1080:00"}

    def test_from_row(self):
        g = GoalieStats.from_row(self.RAW)
        assert g.gp == 18
        assert g.w  == 14
        assert g.l  == 3
        assert g.ot == 1
        assert g.gaa    == pytest.approx(1.82)
        assert g.sv_pct == pytest.approx(93.1)
        assert g.so  == 2
        assert g.toi == "1080:00"

    def test_to_dict_keys(self):
        d = GoalieStats.from_row(self.RAW).to_dict()
        assert set(d.keys()) == {"gp", "w", "l", "ot", "gaa", "sv_pct", "so", "toi"}

    def test_missing_values(self):
        g = GoalieStats.from_row({"GP": "-", "W": "", "SV%": "N/A"})
        assert g.gp is None
        assert g.w  is None


class TestSkaterStats:
    RAW = {"GP": "26", "G": "22", "A": "19", "TP": "41",
           "+/-": "8", "PIM": "14", "PPG": "5", "SHG": "1"}

    def test_from_row(self):
        s = SkaterStats.from_row(self.RAW)
        assert s.gp  == 26
        assert s.g   == 22
        assert s.a   == 19
        assert s.pts == 41
        assert s.plus_minus == 8
        assert s.pim == 14
        assert s.ppg == 5
        assert s.shg == 1

    def test_pts_fallback_to_pts_key(self):
        s = SkaterStats.from_row({"GP": "10", "G": "3", "A": "5", "PTS": "8"})
        assert s.pts == 8


class TestStatRow:
    def _make(self, **kw):
        defaults = dict(
            player_url="https://www.eliteprospects.com/player/1/foo",
            player_name="Foo Bar",
            player_id="1",
            season="2025-2026",
            league="ushs-prep",
            team="Albany Academy",
            position="G",
            stat_type="REGULAR_SEASON",
            stats={},
        )
        defaults.update(kw)
        return StatRow(**defaults)

    def test_upsert_filter(self):
        row = self._make()
        f = row.upsert_filter
        assert f["player_url"] == "https://www.eliteprospects.com/player/1/foo"
        assert f["season"]     == "2025-2026"
        assert f["league"]     == "ushs-prep"
        assert f["stat_type"]  == "REGULAR_SEASON"

    def test_to_dict_has_all_keys(self):
        d = self._make().to_dict()
        for key in ("player_url", "player_name", "player_id", "season",
                    "league", "team", "position", "stat_type", "stats"):
            assert key in d


class TestPlayerDocument:
    JSONLD = {
        "url": "https://www.eliteprospects.com/player/1/foo",
        "name": "Foo Bar",
        "birthDate": "2010-07-29",
        "birthPlace": {"name": "Troy, NY"},
        "nationality": {"name": "USA"},
        "knowsAbout": ["Ice hockey", "Goaltender", "USHS-Prep"],
    }

    def test_from_jsonld(self):
        doc = PlayerDocument.from_jsonld(self.JSONLD, year="2025-2026", team_id="tid1")
        assert doc.url        == self.JSONLD["url"]
        assert doc.name       == "Foo Bar"
        assert doc.birth_date == "2010-07-29"
        assert doc.year       == "2025-2026"

    def test_upsert_filter(self):
        doc = PlayerDocument.from_jsonld(self.JSONLD, year="2025-2026", team_id="x")
        f = doc.upsert_filter
        assert f["url"]  == self.JSONLD["url"]
        assert f["year"] == "2025-2026"
