from datetime import datetime
import json
import os
import sys
from bs4 import BeautifulSoup
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import requests
import time
import random

# Configuration variables
MONGO_URI = os.getenv("MONGO_URI", "mongodb://shashipahwa:StudyHard$@localhost:27017/player_analysis_db")
DB_NAME = "player_analysis_db"
SOURCE_COLLECTION = "league_members"
DEST_COLLECTION = "teams"


# Define the target execution year (Defaults to the current calendar year)
#TARGET_YEAR = int(os.getenv("SCRAPE_YEAR", datetime.now().year))
TARGET_YEAR=2025

def handle_collection_reset(source_col, dest_col):
    """Checks for existing team data and safely handles data purging and flag resets."""
    try:
        doc_count = dest_col.count_documents({})
        if doc_count > 0:
            print(
                f"\n[WARNING] Destination collection '{DEST_COLLECTION}' contains {doc_count} records."
            )
            print(
                f"Clearing this data will also reset the 'scraped' progress flag inside '{SOURCE_COLLECTION}'."
            )

            # Request user validation to ensure absolute safety
            user_input = (
                input("Do you want to RESET everything and start over? (yes/no): ")
                .strip()
                .lower()
            )

            if user_input in ["yes", "y"]:
                # 1. Clear the destination collection completely
                dest_col.delete_many({})
                print(f"-> Dropped all documents in destination '{DEST_COLLECTION}'.")

                # 2. Reset the tracking status flags back to False in the source collection
                # Changes both explicitly set True flags and missing fields to a clean state
                reset_result = source_col.update_many(
                    {"scraped": True}, {"$set": {"scraped": False}}
                )
                print(
                    f"-> Successfully reset {reset_result.modified_count} items in '{SOURCE_COLLECTION}' to scraped=False."
                )
                print("System reset complete. Starting fresh processing loop...\n")
            else:
                print(
                    "Resuming process. Existing team records will be preserved and skipped.\n"
                )
        else:
            print("Destination collection is empty. Ready to scan.")
    except PyMongoError as err:
        print(f"Error executing database reset operation: {err}")
        sys.exit(1)


def process_sports_teams(target_year):
    client = None
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        source_col = db[SOURCE_COLLECTION]
        dest_col = db[DEST_COLLECTION]

        handle_collection_reset(source_col, dest_col)

        print("\nExtracting unvisited teams URLs from organization pages...")

        # Find documents that have a URL and haven't been visited yet
        query = {"url": {"$exists": True}, "scraped": {"$ne": False}}
        cursor = source_col.find(query)

        for document in cursor:
            doc_id = document["_id"]
            target_url = document.get("url")
            team_name = document.get("name", "Unknown Team")

            if not target_url:
                print(f"Skipping ID {doc_id}: No URL field found.")
                continue

            try:
                print(
                    f"Calling URL for {team_name}: {target_url} (Target Year: {target_year})"
                )

                # Configure standard browser headers to avoid getting blocked
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }

                # Make the HTTP GET request to the team's URL
                response = requests.get(target_url, headers=headers, timeout=15)
                response.raise_for_status()

                # Parse the HTML response
                # Introduces a random floating-point sleep interval between 1.5 and 3.0 seconds
                sleep_duration = random.uniform(1.5, 3.0)
                print(f"Sleeping for {sleep_duration:.2f} seconds to protect server load...")
                time.sleep(sleep_duration)
                # -----------------------------------
                soup = BeautifulSoup(response.text, "html.parser")

                # Find the specific script tag using its attributes
                script_tags = soup.find_all(
                    "script",
                    attrs={"type": "application/ld+json", "data-next-head": ""},
                )

                sports_team_data = None

                # Iterate through tags to find the correct data payload
                for tag in script_tags:
                    if tag.string:
                        try:
                            data = json.loads(tag.string)
                            # Check if this specific JSON object represents the SportsTeam
                            if data.get("@type") == "SportsTeam":
                                sports_team_data = data
                                break  # Stop searching once found
                        except json.JSONDecodeError:
                            continue

                # If data was extracted, write it to its own distinct collection
                if sports_team_data:
                    unique_team_url = sports_team_data.get("mainEntityOfPage")

                    if unique_team_url:
                        # Append the seasonal/historical year attribute
                        sports_team_data["year"] = target_year
                        sports_team_data["source_member_id"] = doc_id
                        sports_team_data["updated_at"] = datetime.now()

                        # Compound upsert filter: matches BOTH the page link AND the specific year.
                        # This permits identical teams to exist natively for separate season records.
                        upsert_filter = {
                            "mainEntityOfPage": unique_team_url,
                            "year": target_year,
                        }

                        dest_col.update_one(
                            upsert_filter, {"$set": sports_team_data}, upsert=True
                        )
                        print(
                            f"Saved {team_name} profile for the year {target_year} into '{DEST_COLLECTION}'"
                        )
                    else:
                        print(
                            f"Warning: Extracted data missing 'mainEntityOfPage' key for {team_name}."
                        )
                else:
                    print(
                        f"Warning: No valid 'SportsTeam' JSON-LD found for {team_name}."
                    )

                # Always mark the source member document as processed
                source_col.update_one({"_id": doc_id}, {"$set": {"scraped": True}})

            except requests.exceptions.RequestException as http_err:
                print(f"Network error for {team_name}: {http_err}")
            except PyMongoError as db_err:
                print(f"Database update failed for {team_name}: {db_err}")

    except PyMongoError as conn_err:
        print(f"Database connection error: {conn_err}")
    finally:
        if client:
            client.close()
            print("MongoDB connection closed.")


if __name__ == "__main__":
    # Pass the targeted execution year configuration variable down to processing loops
    process_sports_teams(TARGET_YEAR)
