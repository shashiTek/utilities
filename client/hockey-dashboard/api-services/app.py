"""
app.py — Flask application factory & entry point

Setup:
    pip install flask flask-cors pymongo python-dotenv

Run:
    python app.py
    # Starts on http://localhost:5000
"""

from flask import Flask
from flask_cors import CORS

from db import MongoEncoder
from routes.players import players_bp
from routes.teams import teams_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.json_encoder = MongoEncoder

    CORS(app)  # Allow React dev server on :3000

    app.register_blueprint(players_bp)
    app.register_blueprint(teams_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    print("Hockey Dashboard API running on http://localhost:5000")
    app.run(debug=True, port=5000)
