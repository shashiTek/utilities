"""
db.py — MongoDB connection and JSON serialisation
"""

import os
import json
from datetime import datetime
from pathlib import Path
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://shashipahwa:StudyHard$@localhost:27017/player_analysis_db")
DB_NAME   = os.getenv("DB_NAME",   "player_analysis_db")

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]


class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def jsonify_mongo(app, data):
    """Return a Flask Response with MongoDB-safe JSON serialisation."""
    return app.response_class(
        json.dumps(data, cls=MongoEncoder),
        mimetype="application/json"
    )
