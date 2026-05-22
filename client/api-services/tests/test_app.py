from types import SimpleNamespace

from routes import players as players_routes
from routes import teams as teams_routes


class DummyDB:
    def __init__(self, stats=None, players=None, teams=None):
        self.stats = stats
        self.players = players
        self.teams = teams

    def __getitem__(self, key):
        return getattr(self, key)


class DummyResult(list):
    def sort(self, *args, **kwargs):
        return self


def test_app_registers_blueprints(client):
    rules = {rule.rule for rule in client.application.url_map.iter_rules()}
    assert "/api/players" in rules
    assert "/api/player/<player_id>" in rules
    assert "/api/metrics" in rules
    assert "/api/charts/birthyear" in rules
    assert "/api/filters" in rules
    assert "/api/teams" in rules
    assert "/api/filters/teams" in rules


def test_get_player_returns_bio_and_stats(client, monkeypatch):
    expected_bio = {"url": "/player/123/", "name": "Test Player"}
    expected_stats = [{"player_id": "123", "season": "2025-2026"}]

    dummy_db = DummyDB(
        players=SimpleNamespace(find_one=lambda *args, **kwargs: expected_bio),
        stats=SimpleNamespace(find=lambda *args, **kwargs: DummyResult(expected_stats)),
    )
    monkeypatch.setattr(players_routes, "db", dummy_db)

    response = client.get("/api/player/123")
    assert response.status_code == 200
    assert response.json["bio"] == expected_bio
    assert response.json["stats"] == expected_stats


def test_get_team_filters_returns_sorted_unique_names(client, monkeypatch):
    class DummyTeamsCollection:
        def distinct(self, field):
            return ["B", "A"] if field == "name" else ["Y", "X"]

    dummy_db = SimpleNamespace(teams=DummyTeamsCollection())
    monkeypatch.setattr(teams_routes, "db", dummy_db)

    response = client.get("/api/filters/teams")
    assert response.status_code == 200
    assert response.json == {"teams": ["A", "B"], "leagues": ["X", "Y"]}


def test_get_teams_roster_aggregates_player_summary(client, monkeypatch):
    team_record = {
        "_id": "1",
        "name": "Test Team",
        "memberOf": {"name": "League Test"},
        "athlete": [{"name": "Player One", "url": "/player/123/"}],
        "coach": [{"name": "Coach Z"}],
        "year": 2025,
        "season": "2025-2026",
    }
    stat_record = {
        "player_id": "123",
        "stat_type": "REGULAR_SEASON",
        "position": "F",
        "stats": {"GP": 10, "G": 4, "A": 5, "PTS": 9},
    }

    dummy_db = DummyDB(
        teams=SimpleNamespace(find=lambda *args, **kwargs: [team_record]),
        stats=SimpleNamespace(find=lambda *args, **kwargs: [stat_record]),
    )
    monkeypatch.setattr(teams_routes, "db", dummy_db)

    response = client.get("/api/teams")
    assert response.status_code == 200
    assert response.json["total"] == 1
    assert response.json["data"][0]["team_name"] == "Test Team"
    assert response.json["data"][0]["stats"]["top_scorer"].startswith("Player One")


def test_get_players_handles_invalid_birth_year_range(client, monkeypatch):
    dummy_db = DummyDB(
        stats=SimpleNamespace(aggregate=lambda *args, **kwargs: []),
        players=SimpleNamespace(),
    )
    monkeypatch.setattr(players_routes, "db", dummy_db)

    response = client.get("/api/players?birthYearFrom=abc&birthYearTo=2025")
    assert response.status_code == 200
    assert response.json["total"] == 0
    assert response.json["data"] == []


def test_team_roster_origins_requires_league(client):
    response = client.get("/api/league/team-roster-origins")
    assert response.status_code == 400
    assert response.json["error"] == "league param required"
