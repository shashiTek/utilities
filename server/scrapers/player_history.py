import json
import random
import time
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright


def scrape_goalie_history_playwright(player_url: str) -> dict | None:
    """Launches Playwright headless browser to fetch and parse dynamic

    goalie history records from an Elite Prospects profile.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        
        page = context.new_page()
        print(f"Opening browser context for goalie profile: {player_url}")
        
        try:
            # FIX 1: Use 'load' threshold to give the initial HTML document time to settle
            page.goto(player_url, wait_until="load", timeout=30000)
            
            # FIX 2: Target text strings present on ALL goalie grids instead of broken class selectors
            print("Waiting for dynamic regular season text nodes to materialize...")
            page.wait_for_selector("text=Regular Season", timeout=15000)
            
            # Additional structural sleep to ensure the async data payload registers inside page.content()
            page.wait_for_timeout(2000)
            
            html_content = page.content()
            browser.close()
        except Exception as e:
            print(f"Browser processing failure: {e}")
            browser.close()
            return None

    # ---- PARSING STAGE ----
    soup = BeautifulSoup(html_content, "html.parser")
    
    # Extract Bio metadata block
    bio_profile = {}
    json_ld_script = soup.find("script", type="application/ld+json")
    if json_ld_script:
        try:
            data = json.loads(json_ld_script.string or "")
            if data.get("@type") == "Person":
                bio_profile = {
                    "name": data.get("name"),
                    "birth_date": data.get("birthDate"),
                    "knows_about": data.get("knowsAbout"),
                }
        except Exception:
            pass

    career_history = []
    
    # FIX 3: Robust table selection via text scanning instead of trusting CSS selectors
    stats_table = None
    for table in soup.find_all("table"):
        table_text = table.get_text().upper()
        if "SEASON" in table_text and "TEAM" in table_text and "LEAGUE" in table_text:
            stats_table = table
            break
                  
    if not stats_table:
        print("Could not isolate a valid stats grid layout from the DOM.")
        return {"bio": bio_profile, "history": []}

    trs = stats_table.find_all("tr")
    
    # Extract column mapping keys dynamically from layout columns
    headers = []
    for tr in trs:
        if tr.find(["th", "td"]):
            # Pull headers from either th elements or the structural baseline header track row
            potential_headers = [th.get_text(strip=True).upper() for th in tr.find_all(["th", "td"])]
            if "SEASON" in potential_headers or "S" in potential_headers:
                headers = potential_headers
                break

    for tr in trs:
        # Skip rows that replicate our columns configuration list
        if tr.find("th") or "header" in str(tr.get("class", "")).lower():
            continue
            
        cells = tr.find_all("td")
        if not cells or len(cells) < 3:
            continue
            
        row_text = [c.get_text(strip=True) for c in cells]
        
        # Guard clause: skip sum metadata rows like 'TOTALS' or navigation markers
        first_cell = row_text[0].lower() if row_text else ""
        if "total" in first_cell or "gp" in first_cell or not row_text:
            continue

        if len(row_text) >= len(headers) and headers:
            rd = dict(zip(headers, row_text[:len(headers)]))
            season = rd.get("SEASON") or rd.get("S")
            team = rd.get("TEAM") or rd.get("POST")
            league = rd.get("LEAGUE") or rd.get("L")
            
            # Isolates numeric metrics dynamically (GP, GA, GAA, SVS, SV% etc.)
            stat_line = {k: v for k, v in rd.items() if k not in ["SEASON", "S", "TEAM", "LEAGUE", "L"]}
        else:
            season = row_text[0] if len(row_text) > 0 else None
            team = row_text[1] if len(row_text) > 1 else None
            league = row_text[2] if len(row_text) > 2 else None
            stat_line = {"raw_row_dump": row_text[3:]}

        if not season or not team:
            continue

        career_history.append({
            "season": season,
            "team_name": team,
            "league_name": league,
            "stats": stat_line
        })

    return {
        "bio": bio_profile,
        "history": career_history
    }


# ---------------------------------------------------------------------------
# Execution Test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    GOALIE_URL = "https://www.eliteprospects.com/player/577161/ryan-cameron"
    
    result = scrape_goalie_history_playwright(GOALIE_URL)
    
    if result and result["history"]:
        print("\n=== EXTRACTED BIO SUMMARY ===")
        print(json.dumps(result["bio"], indent=2))
        
        print("\n=== DYNAMIC GOALIE CAREER HISTORY ===")
        for index, row in enumerate(result["history"], start=1):
            print(f"[{index}] {row['season']} | Team: {row['team_name']} | League: {row['league_name']}")
            print(f"    Metrics Captured: {row['stats']}")
    else:
        print("\nFailed to extract history. Confirm the browser environment binaries are configured.")
