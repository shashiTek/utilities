import json
import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient

# 1. Target URL
url = "https://www.eliteprospects.com/league/ushs-prep"

# 2. Add headers to mimic a browser request to avoid getting blocked
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

try:
    # 3. Fetch the webpage content
    response = requests.get(url, headers=headers)
    response.raise_for_status()  # Check for HTTP errors

    # 4. Parse the HTML
    soup = BeautifulSoup(response.text, "html.parser")

    # 5. Find the specific script tag using its attributes
    script_tags = soup.find_all(
        "script", attrs={"type": "application/ld+json", "data-next-head": ""}
    )

    sports_org_data = None

    # 2. Iterate through them to find the correct data payload
    for tag in script_tags:
        if tag.string:
            try:
                data = json.loads(tag.string)

                # Check if this specific JSON object represents the SportsOrganization
                if data.get("@type") == "SportsOrganization":
                    sports_org_data = data
                    break  # Stop searching once found
            except json.JSONDecodeError:
                continue

    # 3. Print and verify the parsed content
    if sports_org_data:
        members = sports_org_data.get("member")

        if members:
            client = MongoClient("mongodb://nyxsvlalb697:27017/")
            
            # Select/Create database and collection
            db = client["elite_prospects_db"]
            collection = db["league_members"]

            # 3. Data Insertion with Upsert (Prevents duplicates if run multiple times)
            inserted_count = 0
            for member in members:
                member_url = member.get("url")
                
                if member_url:
                    # Use 'update_one' with upsert=True to add or update records safely
                    result = collection.update_one(
                        {"url": member_url},           # Unique identifier filter
                        {"$set": {                     # Fields to insert/update
                            "name": member.get("name"),
                            "@type": member.get("@type"),
                            "parent_organization": sports_org_data.get("name")
                        }},
                        upsert=True
                    )
                    if result.upserted_id or result.modified_count > 0:
                        inserted_count += 1

            print(f"Database sync complete. Processed/Updated {inserted_count} member records.")
            
            # Close connection
            client.close()
        else:
            print("The 'member' tag was not found or is empty inside sports_org_data.")

    else:
        print("Could not find a script tag containing '@type':'SportsOrganization'")

except requests.exceptions.RequestException as e:
    print(f"Error fetching the URL: {e}")
except json.JSONDecodeError:
    print("Error parsing the JSON text inside the script tag.")
