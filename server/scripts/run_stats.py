"""server/scripts/run_stats.py"""
from server.scrapers import StatsScraper

def main():
    StatsScraper().run()

if __name__ == "__main__":
    main()
