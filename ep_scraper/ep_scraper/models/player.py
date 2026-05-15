"""ep_scraper/models/player.py — Player document model."""

from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional


@dataclass
class PlayerDocument:
    url:            str
    name:           str
    year:           object          # season year from the team doc
    birth_date:     Optional[str]   = None
    birth_place:    Optional[dict]  = None
    nationality:    Optional[dict]  = None
    knows_about:    Optional[list]  = None
    source_team_id: object          = None
    updated_at:     datetime        = None

    @classmethod
    def from_jsonld(cls, person: dict, year, team_id) -> "PlayerDocument":
        return cls(
            url            = person.get("url", ""),
            name           = person.get("name", ""),
            birth_date     = person.get("birthDate"),
            birth_place    = person.get("birthPlace"),
            nationality    = person.get("nationality"),
            knows_about    = person.get("knowsAbout"),
            year           = year,
            source_team_id = team_id,
            updated_at     = datetime.utcnow(),
        )

    def to_dict(self) -> dict:
        return {
            "url":            self.url,
            "name":           self.name,
            "birthDate":      self.birth_date,
            "birthPlace":     self.birth_place,
            "nationality":    self.nationality,
            "knowsAbout":     self.knows_about,
            "year":           self.year,
            "source_team_id": self.source_team_id,
            "updated_at":     self.updated_at,
        }

    @property
    def upsert_filter(self) -> dict:
        return {"url": self.url, "year": self.year}
