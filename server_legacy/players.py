from datetime import datetime
import json
import os
import time
import random
from bs4 import BeautifulSoup
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import requests

# Configuration variables
MONGO_URI = os.getenv("MONGO_URI", "mongodb://shashipahwa:StudyHard$@localhost:27017/player_analysis_db")
DB_NAME = "player_analysis_db"
SOURCE_COLLECTION = "teams"
DEST_COLLECTION = "players"


def process_players():
    client = None
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        teams_col = db[SOURCE_COLLECTION]
        players_col = db[DEST_COLLECTION]

        print("Extracting unvisited player URLs from team rosters...")

        # Aggregate unique athlete URLs from teams
        pipeline = [
            {"$match": {"athlete": {"$exists": True}}},
            {"$unwind": "$athlete"},
            {
                "$project": {
                    "player_url": "$athlete.url",
                    "player_name": "$athlete.name",
                    "team_id": "$_id",
                    "team_year": "$year",
                }
            },
        ]

        # Fetch records using aggregation cursor
        athletes = list(teams_col.aggregate(pipeline))
        print(f"Found {len(athletes)} total player links to verify.")

        for athlete in athletes:
            target_url = athlete.get("player_url")
            player_name = athlete.get("player_name", "Unknown Player")
            team_id = athlete.get("team_id")
            team_year = athlete.get("team_year")

            if not target_url:
                continue

            # Skip if we already successfully stored this specific player profile for this season
            if players_col.find_one({"url": target_url, "year": team_year}):
                continue

            try:
                print(f"Calling player URL for {player_name}: {target_url}")

                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }

                # HTTP GET payload call to player profile
                response = requests.get(target_url, headers=headers, timeout=15)
                response.raise_for_status()

                # --- RATE LIMIT PREVENTION DELAY ---
                # Introduces a random floating-point sleep interval between 1.5 and 3.0 seconds
                sleep_duration = random.uniform(1.5, 3.0)
                print(f"Sleeping for {sleep_duration:.2f} seconds to protect server load...")
                time.sleep(sleep_duration)
                # -----------------------------------

                soup = BeautifulSoup(response.text, "html.parser")

                # Isolate target schema tag blocks
                script_tags = soup.find_all(
                    "script",
                    attrs={"type": "application/ld+json", "data-next-head": ""},
                )

                person_data = None
                for tag in script_tags:
                    if tag.string:
                        try:
                            data = json.loads(tag.string)
                            if data.get("@type") == "Person":
                                person_data = data
                                break
                        except json.JSONDecodeError:
                            continue

                if person_data:
                    # Filter and extract ONLY requested structural fields
                    filtered_player_doc = {
                        "url": person_data.get("url"),
                        "name": person_data.get("name"),
                        "birthDate": person_data.get("birthDate"),
                        "birthPlace": person_data.get("birthPlace"),
                        "nationality": person_data.get("nationality"),
                        "knowsAbout": person_data.get("knowsAbout"),
                        # Metadata tracking
                        "year": team_year,
                        "source_team_id": team_id,
                        "updated_at": datetime.utcnow(),
                    }

                    # Compound identifier tracking unique user link + snapshot season year
                    upsert_filter = {"url": target_url, "year": team_year}

                    players_col.update_one(
                        upsert_filter, {"$set": filtered_player_doc}, upsert=True
                    )
                    print(f"Successfully stored distinct profile for: {player_name}\n")

                else:
                    print(
                        f"Warning: No valid 'Person' JSON-LD found for {player_name}.\n"
                    )

            except requests.exceptions.RequestException as http_err:
                print(f"Network request failed for player {player_name}: {http_err}\n")
                # Sleep briefly even on failure to avoid rapid-fire retry errors
                time.sleep(2)
            except PyMongoError as db_err:
                print(f"Database update failed for player {player_name}: {db_err}\n")

    except PyMongoError as conn_err:
        print(f"Database connection pipeline error: {conn_err}")
    finally:
        if client:
            client.close()
            print("MongoDB connection closed.")


if __name__ == "__main__":
    process_players()
