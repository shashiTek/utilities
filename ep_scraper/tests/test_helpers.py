"""Tests for pure utility functions."""

import pytest
from ep_scraper.utils.helpers import (
    extract_player_id,
    league_name_to_slug,
    normalise_url,
    safe_float,
    safe_int,
    year_to_season,
)


class TestYearToSeason:
    def test_2025(self):
        assert year_to_season(2025) == "2025-2026"

    def test_2024(self):
        assert year_to_season(2024) == "2024-2025"

    def test_2000(self):
        assert year_to_season(2000) == "2000-2001"


class TestLeagueNameToSlug:
    def test_ushs_prep(self):
        assert league_name_to_slug("USHS-Prep") == "ushs-prep"

    def test_ohl(self):
        assert league_name_to_slug("OHL") == "ohl"

    def test_spaces(self):
        assert league_name_to_slug("NCAA D-I") == "ncaa-d-i"

    def test_empty(self):
        assert league_name_to_slug("") == ""

    def test_none(self):
        assert league_name_to_slug(None) == ""


class TestNormaliseUrl:
    BASE = "https://www.eliteprospects.com"

    def test_relative(self):
        assert normalise_url("/player/1/foo") == f"{self.BASE}/player/1/foo"

    def test_trailing_slash(self):
        assert normalise_url(f"{self.BASE}/player/1/foo/") == f"{self.BASE}/player/1/foo"

    def test_already_full(self):
        assert normalise_url(f"{self.BASE}/team/5/bar") == f"{self.BASE}/team/5/bar"

    def test_empty(self):
        assert normalise_url("") == ""

    def test_none(self):
        assert normalise_url(None) == ""


class TestExtractPlayerId:
    def test_standard_url(self):
        assert extract_player_id(
            "https://www.eliteprospects.com/player/1114621/benjamin-art"
        ) == "1114621"

    def test_relative(self):
        assert extract_player_id("/player/999/foo-bar") == "999"

    def test_no_match(self):
        assert extract_player_id("https://www.eliteprospects.com/team/5/foo") is None

    def test_none(self):
        assert extract_player_id(None) is None


class TestSafeInt:
    def test_int(self):      assert safe_int(14) == 14
    def test_string(self):   assert safe_int("14") == 14
    def test_float(self):    assert safe_int(14.9) == 14
    def test_empty(self):    assert safe_int("") is None
    def test_dash(self):     assert safe_int("-") is None
    def test_none(self):     assert safe_int(None) is None


class TestSafeFloat:
    def test_float(self):    assert safe_float(1.82) == 1.82
    def test_string(self):   assert safe_float("1.82") == 1.82
    def test_pct(self):      assert safe_float("93.1%") == 93.1
    def test_empty(self):    assert safe_float("") is None
    def test_none(self):     assert safe_float(None) is None
