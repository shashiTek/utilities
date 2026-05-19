"""
routes/players.py — Player-related endpoints

  GET /api/players            — paginated player list with metrics
  GET /api/player/<player_id> — single player detail
  GET /api/metrics            — summary metric cards
  GET /api/charts/birthyear   — player counts per birth year
  GET /api/filters            — distinct dropdown values
"""

from flask import Blueprint, request, jsonify, current_app
from pymongo.errors import PyMongoError

from db import db, jsonify_mongo
from utils import build_query_string

players_bp = Blueprint("players", __name__)


# ---------------------------------------------------------------------------
# GET /api/players
# ---------------------------------------------------------------------------
# Query params:
#   birthYear  — integer e.g. 2010
#   season     — string  e.g. "2025-2026"
#   league     — string  e.g. "ushs-prep"
#   position   — string  "G" | "F/D"
#   search     — string  (matches name or team, case-insensitive)
#   page       — integer (default 0)
#   pageSize   — integer (default 50)
#   sortBy     — field name (default "player_name")
#   sortDir    — "asc" | "desc" (default "asc")
# ---------------------------------------------------------------------------
@players_bp.route("/api/players")
def get_players():
    try:
        birth_year = request.args.get("birthYear")
        season     = request.args.get("season")
        league     = request.args.get("league")
        position   = request.args.get("position")
        search     = request.args.get("search", "").strip()
        page       = int(request.args.get("page", 0))
        page_size  = int(request.args.get("pageSize", 50))
        sort_by    = request.args.get("sortBy", "player_name")
        sort_dir   = 1 if request.args.get("sortDir", "asc") == "asc" else -1

        stats_collection = db["stats"]

        # 1. Base query construction
        base_match = {}
        if season:   base_match["season"]   = season
        if league:   base_match["league"]   = league
        if position: base_match["position"] = position
        if search:
            base_match["$or"] = [
                {"player_name": {"$regex": search, "$options": "i"}},
                {"team":        {"$regex": search, "$options": "i"}},
            ]

        pipeline = [{"$match": base_match}] if base_match else []

        # 2. Join with players bio
        pipeline += [
            {
                "$lookup": {
                    "from": "players",
                    "localField": "player_url",
                    "foreignField": "url",
                    "as": "bio"
                }
            },
            {"$unwind": {"path": "$bio", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "birthYearRaw": {
                        "$toInt": {
                            "$substr": [
                                {"$ifNull": ["$bio.birthDate", "0000-00-00"]}, 0, 4
                            ]
                        }
                    },
                    "birthDate":   "$bio.birthDate",
                    "birthPlace":  "$bio.birthPlace",
                    "nationality": "$bio.nationality",
                    "knowsAbout":  "$bio.knowsAbout",
                }
            },
            {
                "$addFields": {
                    "birthYear": {
                        "$cond": {
                            "if": {"$or": [
                                {"$eq": ["$birthYearRaw", 0]},
                                {"$eq": ["$birthYearRaw", None]}
                            ]},
                            "then": "N/A",
                            "else": "$birthYearRaw"
                        }
                    }
                }
            }
        ]

        # 3. Birth year post-filter
        if birth_year:
            try:
                pipeline.append({"$match": {"birthYearRaw": int(birth_year)}})
            except ValueError:
                if birth_year.upper() == "N/A":
                    pipeline.append({"$match": {"birthYear": "N/A"}})

        # 4. Metrics aggregation
        metrics = {
            "totalPlayers": 0, "forwards": 0, "defensemen": 0, "goalies": 0,
            "avgGP": 0, "avgGAA": 0, "avgSVP": 0, "maxPTS": 0, "leagueCount": 0,
            "topForwardScorer": "—", "maxForwardPts": 0,
            "topDefenseScorer": "—", "maxDefensePts": 0, "avgDefenseBlks": 0,
            "topGoalie": "—", "maxGoalieSVP": 0, "topGoalieGAA": 0
        }

        _fwd_positions  = ["F", "LW", "RW", "C", "FORWARD", "F/D", "F-D"]
        _def_positions  = ["D", "DEF", "DEFENSE", "DEFENSEMAN", "F/D", "F-D"]
        _gk_positions   = ["G", "GK", "GOALIE"]

        def _pos_upper(field):
            return {"$toUpper": {"$ifNull": [field, ""]}}

        metrics_pipeline = list(pipeline) + [
            {
                "$group": {
                    "_id": None,
                    "totalPlayers": {"$sum": 1},
                    "forwards": {
                        "$sum": {
                            "$cond": [
                                {"$or": [
                                    {"$in": [_pos_upper("$position"),       _fwd_positions]},
                                    {"$in": [_pos_upper("$stats.position"), _fwd_positions]}
                                ]},
                                1, 0
                            ]
                        }
                    },
                    "defensemen": {
                        "$sum": {
                            "$cond": [
                                {"$or": [
                                    {"$in": [_pos_upper("$position"),       _def_positions]},
                                    {"$in": [_pos_upper("$stats.position"), _def_positions]}
                                ]},
                                1, 0
                            ]
                        }
                    },
                    "goalies": {
                        "$sum": {
                            "$cond": [
                                {"$or": [
                                    {"$in": [_pos_upper("$position"),       _gk_positions]},
                                    {"$in": [_pos_upper("$stats.position"), _gk_positions]}
                                ]},
                                1, 0
                            ]
                        }
                    },
                    "avgGP":  {"$avg": "$stats.gp"},
                    "avgGAA": {"$avg": {"$cond": [{"$gt": ["$stats.gaa",    0]}, "$stats.gaa",    "$$REMOVE"]}},
                    "avgSVP": {"$avg": {"$cond": [{"$gt": ["$stats.sv_pct", 0]}, "$stats.sv_pct", "$$REMOVE"]}},
                    "maxPTS": {"$max": "$stats.pts"},
                    "leagues": {"$addToSet": "$league"},
                    "all_players": {
                        "$push": {
                            "name":     "$player_name",
                            "position": _pos_upper("$position"),
                            "pts":      {"$ifNull": ["$stats.pts",    0]},
                            "svp":      {"$ifNull": ["$stats.sv_pct", 0]},
                            "gaa":      {"$ifNull": ["$stats.gaa",    0]}
                        }
                    },
                    "avgDefenseBlks": {
                        "$avg": {
                            "$cond": [
                                {"$in": [_pos_upper("$position"), ["D", "DEF"]]},
                                "$stats.blocked_shots",
                                "$$REMOVE"
                            ]
                        }
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "totalPlayers": 1, "forwards": 1, "defensemen": 1, "goalies": 1,
                    "avgGP": 1, "avgGAA": 1, "avgSVP": 1, "maxPTS": 1,
                    "avgDefenseBlks": {"$ifNull": ["$avgDefenseBlks", 0]},
                    "leagueCount": {"$size": "$leagues"},
                    "top_forwards": {
                        "$sortArray": {
                            "input": {"$filter": {
                                "input": "$all_players", "as": "p",
                                "cond": {"$in": ["$$p.position", ["F", "LW", "RW", "C", "FORWARD"]]}
                            }},
                            "sortBy": {"pts": -1}
                        }
                    },
                    "top_defense": {
                        "$sortArray": {
                            "input": {"$filter": {
                                "input": "$all_players", "as": "p",
                                "cond": {"$in": ["$$p.position", ["D", "DEF", "DEFENSE", "DEFENSEMAN"]]}
                            }},
                            "sortBy": {"pts": -1}
                        }
                    },
                    "top_goalies": {
                        "$sortArray": {
                            "input": {"$filter": {
                                "input": "$all_players", "as": "p",
                                "cond": {"$in": ["$$p.position", ["G", "GK", "GOALIE"]]}
                            }},
                            "sortBy": {"svp": -1}
                        }
                    }
                }
            },
            {
                "$project": {
                    "totalPlayers": 1, "forwards": 1, "defensemen": 1, "goalies": 1,
                    "avgGP": 1, "avgGAA": 1, "avgSVP": 1, "maxPTS": 1,
                    "avgDefenseBlks": 1, "leagueCount": 1,
                    "first_forward": {"$arrayElemAt": ["$top_forwards", 0]},
                    "first_defense": {"$arrayElemAt": ["$top_defense",  0]},
                    "first_goalie":  {"$arrayElemAt": ["$top_goalies",  0]}
                }
            }
        ]

        try:
            metrics_result = list(stats_collection.aggregate(metrics_pipeline))
            if metrics_result:
                row = metrics_result[0]

                raw_svp = row.get("avgSVP") or 0.0
                if 0.0 < raw_svp <= 1.0:
                    raw_svp *= 100.0

                f_top = row.get("first_forward") or {}
                d_top = row.get("first_defense")  or {}
                g_top = row.get("first_goalie")   or {}

                raw_g_svp = g_top.get("svp", 0.0)
                if 0.0 < raw_g_svp <= 1.0:
                    raw_g_svp *= 100.0

                metrics = {
                    "totalPlayers":    row.get("totalPlayers", 0),
                    "forwards":        row.get("forwards",     0),
                    "defensemen":      row.get("defensemen",   0),
                    "goalies":         row.get("goalies",      0),
                    "avgGP":           row.get("avgGP")  or 0,
                    "avgGAA":          row.get("avgGAA") or 0,
                    "avgSVP":          raw_svp,
                    "maxPTS":          row.get("maxPTS") or 0,
                    "leagueCount":     row.get("leagueCount", 0),
                    "topForwardScorer": f_top.get("name", "—"),
                    "maxForwardPts":    f_top.get("pts",  0),
                    "topDefenseScorer": d_top.get("name", "—"),
                    "maxDefensePts":    d_top.get("pts",  0),
                    "avgDefenseBlks":   round(row.get("avgDefenseBlks", 0), 1),
                    "topGoalie":        g_top.get("name", "—"),
                    "maxGoalieSVP":     raw_g_svp,
                    "topGoalieGAA":     g_top.get("gaa", 0.0)
                }
        except Exception as e:
            print(f"Metrics aggregation error: {e}")

        # 5. Paginated table data
        total = metrics["totalPlayers"]
        pipeline += [
            {"$sort": {sort_by: sort_dir}},
            {"$skip": page * page_size},
            {"$limit": page_size},
            {"$project": {"bio": 0, "birthYearRaw": 0, "source_player_id": 0}}
        ]
        results = list(stats_collection.aggregate(pipeline))

        return jsonify_mongo(current_app, {
            "total":    total,
            "page":     page,
            "pageSize": page_size,
            "pages":    (total + page_size - 1) // page_size,
            "data":     results,
            "metrics":  metrics
        })

    except Exception as e:
        print(f"Error in get_players: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/player/<player_id>
# ---------------------------------------------------------------------------
@players_bp.route("/api/player/<player_id>")
def get_player(player_id):
    try:
        bio = db.players.find_one(
            {"url": {"$regex": f"/player/{player_id}/"}},
            {"_id": 0}
        )
        stats = list(
            db.stats.find(
                {"player_id": player_id},
                {"_id": 0, "source_player_id": 0, "source_team_id": 0}
            ).sort("season", -1)
        )
        return jsonify_mongo(current_app, {"bio": bio, "stats": stats})
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/metrics
# ---------------------------------------------------------------------------
@players_bp.route("/api/metrics")
def get_metrics():
    birth_year = request.args.get("birthYear")
    season     = request.args.get("season")
    league     = request.args.get("league")
    position   = request.args.get("position")

    match = {}
    if birth_year:
        try:
            match["birthYear"] = int(birth_year)
        except ValueError:
            pass
    if season:   match["season"]   = season
    if league:   match["league"]   = league
    if position: match["position"] = position

    pipeline = [
        {"$lookup": {
            "from": "players",
            "localField": "player_url",
            "foreignField": "url",
            "as": "bio"
        }},
        {"$unwind": {"path": "$bio", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {
            "birthYear": {
                "$toInt": {"$substr": [{"$ifNull": ["$bio.birthDate", "0000"]}, 0, 4]}
            }
        }},
    ]
    if match:
        pipeline.append({"$match": match})

    pipeline += [{
        "$group": {
            "_id":          None,
            "totalPlayers": {"$sum": 1},
            "goalies":      {"$sum": {"$cond": [{"$eq": ["$position", "G"]}, 1, 0]}},
            "skaters":      {"$sum": {"$cond": [{"$ne": ["$position", "G"]}, 1, 0]}},
            "avgGP":        {"$avg": "$stats.gp"},
            "avgGAA":       {"$avg": "$stats.gaa"},
            "avgSVP":       {"$avg": "$stats.sv_pct"},
            "maxPTS":       {"$max": "$stats.pts"},
            "leagues":      {"$addToSet": "$league"},
            "seasons":      {"$addToSet": "$season"},
        }
    }]

    try:
        result = list(db.stats.aggregate(pipeline))
        if result:
            r = result[0]
            r.pop("_id", None)
            r["leagueCount"] = len(r.pop("leagues", []))
            r["seasonCount"]  = len(r.pop("seasons",  []))
            return jsonify_mongo(current_app, r)
        return jsonify({})
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/charts/birthyear
# ---------------------------------------------------------------------------
@players_bp.route("/api/charts/birthyear")
def chart_birthyear():
    pipeline = [
        {"$lookup": {
            "from": "players",
            "localField": "player_url",
            "foreignField": "url",
            "as": "bio"
        }},
        {"$unwind": {"path": "$bio", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {
            "birthYear": {
                "$toInt": {"$substr": [{"$ifNull": ["$bio.birthDate", "0000"]}, 0, 4]}
            }
        }},
        {"$group": {"_id": "$birthYear", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$gt": 1990}}},
        {"$sort":  {"_id": 1}},
        {"$project": {"year": "$_id", "count": 1, "_id": 0}}
    ]
    try:
        return jsonify_mongo(current_app, list(db.stats.aggregate(pipeline)))
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/filters
# ---------------------------------------------------------------------------
@players_bp.route("/api/filters")
def get_filters():
    try:
        birth_years = sorted([
            int(y[:4]) for y in db.players.distinct("birthDate")
            if y and len(y) >= 4 and y[:4].isdigit()
        ], reverse=True)

        seasons   = sorted(db.stats.distinct("season"),   reverse=True)
        leagues   = sorted(db.stats.distinct("league"))
        positions = sorted(db.stats.distinct("position"))

        return jsonify({
            "birthYears": birth_years,
            "seasons":    seasons,
            "leagues":    leagues,
            "positions":  positions,
        })
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500
