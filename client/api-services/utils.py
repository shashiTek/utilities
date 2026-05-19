"""
utils.py — Shared helper functions
"""


def safe_int(val):
    """Safely convert a value to int, returning 0 on failure."""
    if val is None or str(val).strip() == "":
        return 0
    try:
        return int(float(str(val).replace(",", "").strip()))
    except (ValueError, TypeError):
        return 0


def get_array_or_dict_val(obj, target_keys, default_val="—"):
    """
    Extract a value from either a list-of-dicts or a plain dict,
    searching by any of the given target_keys.
    """
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                val = next((item[k] for k in target_keys if k in item), None)
                if val is not None:
                    return val
            elif str(item).strip().lower() in [str(k).lower() for k in target_keys]:
                return item
    elif isinstance(obj, dict):
        return next((obj[k] for k in target_keys if k in obj), default_val)
    return default_val


def build_query_string(birth_year, season, league, position, search):
    """Build a human-readable MongoDB query string for UI display."""
    parts = []
    if birth_year: parts.append(f'"birthYear": {birth_year}')
    if season:     parts.append(f'"season": "{season}"')
    if league:     parts.append(f'"league": "{league}"')
    if position:   parts.append(f'"position": "{position}"')
    if search:
        parts.append(
            f'"$or": [{{"player_name": /{search}/i}}, {{"team": /{search}/i}}]'
        )
    inner = "{\n    " + ",\n    ".join(parts) + "\n  }" if parts else "{}"
    return (
        f'db.stats.aggregate([\n'
        f'  {{ $lookup: {{ from: "players", localField: "player_url",\n'
        f'      foreignField: "url", as: "bio" }} }},\n'
        f'  {{ $unwind: "$bio" }},\n'
        f'  {{ $addFields: {{ birthYear: {{ $toInt: {{ $substr: ["$bio.birthDate", 0, 4] }} }} }} }},\n'
        f'  {{ $match: {inner} }},\n'
        f'  {{ $sort: {{ player_name: 1 }} }}\n'
        f'])'
    )
