"""
db.py — MongoDB connection and JSON serialisation
"""

import os
import json
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

MONGO_URI = os.getenv("MONGO_URI", "mongodb://nyxsvlalb697:27017/")
DB_NAME   = os.getenv("DB_NAME",   "elite_prospects_db")

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
