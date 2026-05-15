"""ep_scraper/scripts/run_teams.py"""
import argparse
from ep_scraper.scrapers import TeamScraper

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--year",  type=int, default=None)
    p.add_argument("--reset", action="store_true")
    args = p.parse_args()
    TeamScraper(target_year=args.year, reset=args.reset).run()

if __name__ == "__main__":
    main()
