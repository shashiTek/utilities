# test_config_check.py
import sys
import os

# Append project root to path if needed to find common module
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

try:
    print("--- Starting Configuration Validation Check ---")
    from common.config import Config
    
    # Instantiate the config class to trigger validation fields
    cfg = Config()
    
    print("\n✅ Configuration loaded successfully!\n")
    print(f"MongoDB URI:    {cfg.mongo_uri}")
    print(f"DB Name:        {cfg.db_name}")
    print(f"Target Year:    {cfg.ep_target_year}")
    print(f"Aging Out Thresh: {cfg.aging_out_years_threshold}")
    print(f"Min Delay:      {cfg.scrape_delay_min}s | Max Delay: {cfg.scrape_delay_max}s")
    print(f"Log Level:      {cfg.log_level}")
    print(f"season: {cfg.season_slug}")

except ValueError as ve:
    print(f"\n❌ CONFIGURATION ERROR: {ve}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"\n❌ UNEXPECTED ERROR: {e}", file=sys.stderr)
    sys.exit(1)
