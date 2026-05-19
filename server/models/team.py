"""server/models/team.py — Team document model."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class TeamDocument:
    main_entity_of_page: str
    year:                int
    raw_data:            dict        # full JSON-LD SportsTeam payload
    source_member_id:    object

    @classmethod
    def from_jsonld(cls, data: dict, year: int, member_id) -> "TeamDocument":
        return cls(
            main_entity_of_page = data.get("mainEntityOfPage", ""),
            year                = year,
            raw_data            = data,
            source_member_id    = member_id,
        )

    def to_dict(self) -> dict:
        doc = dict(self.raw_data)
        doc["year"]             = self.year
        doc["source_member_id"] = self.source_member_id
        doc["updated_at"]       = datetime.now()
        return doc

    @property
    def upsert_filter(self) -> dict:
        return {"mainEntityOfPage": self.main_entity_of_page, "year": self.year}
