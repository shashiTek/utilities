"""
ep_scraper/models/stats.py
--------------------------
Typed dataclasses for goalie and skater stats rows.
Using dataclasses (not Pydantic) to keep the dependency list lean.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

from ep_scraper.utils.helpers import safe_float, safe_int


@dataclass
class GoalieStats:
    gp:     Optional[int]   = None
    w:      Optional[int]   = None
    l:      Optional[int]   = None
    ot:     Optional[int]   = None
    gaa:    Optional[float] = None
    sv_pct: Optional[float] = None
    so:     Optional[int]   = None
    toi:    Optional[str]   = None   # e.g. "1080:00"

    @classmethod
    def from_row(cls, row: dict) -> "GoalieStats":
        return cls(
            gp     = safe_int(row.get("GP")),
            w      = safe_int(row.get("W")),
            l      = safe_int(row.get("L")),
            ot     = safe_int(row.get("OT")),
            gaa    = safe_float(row.get("GAA")),
            sv_pct = safe_float(row.get("SV%")),
            so     = safe_int(row.get("SO")),
            toi    = row.get("MIN") or row.get("TOI") or row.get("MINS"),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SkaterStats:
    gp:         Optional[int] = None
    g:          Optional[int] = None
    a:          Optional[int] = None
    pts:        Optional[int] = None
    plus_minus: Optional[int] = None
    pim:        Optional[int] = None
    ppg:        Optional[int] = None
    shg:        Optional[int] = None

    @classmethod
    def from_row(cls, row: dict) -> "SkaterStats":
        return cls(
            gp         = safe_int(row.get("GP")),
            g          = safe_int(row.get("G")),
            a          = safe_int(row.get("A")),
            pts        = safe_int(row.get("TP") or row.get("PTS")),
            plus_minus = safe_int(row.get("+/-") or row.get("PM")),
            pim        = safe_int(row.get("PIM")),
            ppg        = safe_int(row.get("PPG")),
            shg        = safe_int(row.get("SHG")),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class StatRow:
    """One player-season-league stat row as stored in MongoDB."""
    player_url:       str
    player_name:      str
    player_id:        Optional[str]
    season:           str
    league:           str
    team:             Optional[str]
    position:         str           # "G" or "F/D"
    stat_type:        str           # "REGULAR_SEASON"
    stats:            dict          # GoalieStats.to_dict() or SkaterStats.to_dict()
    source_team_id:   object = None
    source_player_id: object = None
    scraped_at:       str    = ""

    def to_dict(self) -> dict:
        return {
            "player_url":       self.player_url,
            "player_name":      self.player_name,
            "player_id":        self.player_id,
            "season":           self.season,
            "league":           self.league,
            "team":             self.team,
            "position":         self.position,
            "stat_type":        self.stat_type,
            "stats":            self.stats,
            "source_team_id":   self.source_team_id,
            "source_player_id": self.source_player_id,
            "scraped_at":       self.scraped_at,
        }

    @property
    def upsert_filter(self) -> dict:
        """Unique key for MongoDB upsert."""
        return {
            "player_url": self.player_url,
            "season":     self.season,
            "league":     self.league,
            "stat_type":  self.stat_type,
        }
