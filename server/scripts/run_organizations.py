"""server/scripts/run_organizations.py"""
from server.scrapers import OrganizationScraper

def main():
    OrganizationScraper().run()

if __name__ == "__main__":
    main()
