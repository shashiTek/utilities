"""
api.py  —  Hockey Dashboard Backend
------------------------------------
Flask REST API that connects to MongoDB and serves player + stats data
to the React dashboard.

Setup:
    pip install flask flask-cors pymongo python-dotenv

Run:
    python api.py
    # Starts on http://localhost:5000
"""

import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from bson import ObjectId
import json

app = Flask(__name__)
CORS(app)  # Allow React dev server on :3000

# ---------------------------------------------------------------------------
# MongoDB connection
# ---------------------------------------------------------------------------
MONGO_URI   = os.getenv("MONGO_URI", "mongodb://nyxsvlalb697:27017/")
DB_NAME     = os.getenv("DB_NAME",   "elite_prospects_db")

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]


# ---------------------------------------------------------------------------
# JSON serialiser — handles ObjectId and datetime
# ---------------------------------------------------------------------------
class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app.json_encoder = MongoEncoder


def jsonify_mongo(data):
    return app.response_class(
        json.dumps(data, cls=MongoEncoder),
        mimetype="application/json"
    )


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
@app.route("/api/players")
def get_players():
    birth_year = request.args.get("birthYear")
    season     = request.args.get("season")
    league     = request.args.get("league")
    position   = request.args.get("position")
    search     = request.args.get("search", "").strip()
    page       = int(request.args.get("page", 0))
    page_size  = int(request.args.get("pageSize", 50))
    sort_by    = request.args.get("sortBy", "player_name")
    sort_dir   = 1 if request.args.get("sortDir", "asc") == "asc" else -1

    # ------------------------------------------------------------------
    # MongoDB aggregation pipeline
    # Joins stats → players on player_url / url
    # Then filters by birth year (computed from players.birthDate)
    # ------------------------------------------------------------------
    pipeline = [
        # Step 1: Join stats with players bio data
        {
            "$lookup": {
                "from": "players",
                "localField": "player_url",
                "foreignField": "url",
                "as": "bio"
            }
        },
        # Step 2: Flatten the bio array (each stat row has one player)
        {"$unwind": {"path": "$bio", "preserveNullAndEmptyArrays": True}},

        # Step 3: Extract birth year from birthDate string "YYYY-MM-DD"
        {
            "$addFields": {
                "birthYear": {
                    "$toInt": {
                        "$substr": [
                            {"$ifNull": ["$bio.birthDate", "0000-00-00"]},
                            0, 4
                        ]
                    }
                },
                "birthDate":    "$bio.birthDate",
                "birthPlace":   "$bio.birthPlace",
                "nationality":  "$bio.nationality",
                "knowsAbout":   "$bio.knowsAbout",
            }
        }
    ]

    # Step 4: Build match stage from query params
    match = {}
    if birth_year:
        try:
            match["birthYear"] = int(birth_year)
        except ValueError:
            pass
    if season:
        match["season"] = season
    if league:
        match["league"] = league
    if position:
        match["position"] = position
    if search:
        match["$or"] = [
            {"player_name": {"$regex": search, "$options": "i"}},
            {"team":        {"$regex": search, "$options": "i"}},
        ]

    if match:
        pipeline.append({"$match": match})

    # Step 5: Count total before pagination
    count_pipeline = pipeline + [{"$count": "total"}]
    try:
        count_result = list(db.stats.aggregate(count_pipeline))
        total = count_result[0]["total"] if count_result else 0
    except PyMongoError:
        total = 0

    # Step 6: Sort + paginate
    pipeline += [
        {"$sort": {sort_by: sort_dir}},
        {"$skip":  page * page_size},
        {"$limit": page_size},
        # Clean output — drop internal Mongo bio sub-doc
        {
            "$project": {
                "bio": 0,
                "source_player_id": 0,
            }
        }
    ]

    try:
        results = list(db.stats.aggregate(pipeline))
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500

    return jsonify_mongo({
        "total":    total,
        "page":     page,
        "pageSize": page_size,
        "pages":    (total + page_size - 1) // page_size,
        "data":     results,
        "query":    build_query_string(birth_year, season, league, position, search)
    })


# ---------------------------------------------------------------------------
# GET /api/filters  — returns distinct filter values for dropdowns
# ---------------------------------------------------------------------------
@app.route("/api/filters")
def get_filters():
    try:
        birth_years = sorted([
            int(y[:4]) for y in db.players.distinct("birthDate")
            if y and len(y) >= 4 and y[:4].isdigit()
        ], reverse=True)

        seasons  = sorted(db.stats.distinct("season"),  reverse=True)
        leagues  = sorted(db.stats.distinct("league"))
        positions = sorted(db.stats.distinct("position"))

        return jsonify({
            "birthYears": birth_years,
            "seasons":    seasons,
            "leagues":    leagues,
            "positions":  positions,
        })
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/metrics  — summary counts for metric cards
# ---------------------------------------------------------------------------
@app.route("/api/metrics")
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
            "_id":        None,
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
            r["seasonCount"] = len(r.pop("seasons", []))
            return jsonify_mongo(r)
        return jsonify({})
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/charts/birthyear  — player counts per birth year (for bar chart)
# ---------------------------------------------------------------------------
@app.route("/api/charts/birthyear")
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
        {"$sort": {"_id": 1}},
        {"$project": {"year": "$_id", "count": 1, "_id": 0}}
    ]
    try:
        return jsonify_mongo(list(db.stats.aggregate(pipeline)))
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /api/player/<player_id>  — single player detail
# ---------------------------------------------------------------------------
@app.route("/api/player/<player_id>")
def get_player(player_id):
    try:
        bio = db.players.find_one(
            {"url": {"$regex": f"/player/{player_id}/"}},
            {"_id": 0}
        )
        stats = list(db.stats.find(
            {"player_id": player_id},
            {"_id": 0, "source_player_id": 0, "source_team_id": 0}
        ).sort("season", -1))

        return jsonify_mongo({"bio": bio, "stats": stats})
    except PyMongoError as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Helper: build the MongoDB query string shown in the UI
# ---------------------------------------------------------------------------
def build_query_string(birth_year, season, league, position, search):
    parts = []
    if birth_year: parts.append(f'"birthYear": {birth_year}')
    if season:     parts.append(f'"season": "{season}"')
    if league:     parts.append(f'"league": "{league}"')
    if position:   parts.append(f'"position": "{position}"')
    if search:     parts.append(f'"$or": [{{"player_name": /{search}/i}}, {{"team": /{search}/i}}]')
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


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Hockey Dashboard API running on http://localhost:5000")
    app.run(debug=True, port=5000)
