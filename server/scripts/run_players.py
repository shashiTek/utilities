"""server/scripts/run_players.py"""
from server.scrapers import PlayerScraper

def main():
    PlayerScraper().run()

if __name__ == "__main__":
    main()
