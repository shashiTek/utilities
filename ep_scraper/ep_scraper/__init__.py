"""
ep_scraper
----------
EliteProspects hockey data scraper.

Pipeline order:
    1. OrganizationScraper  →  league_members  collection
    2. TeamScraper          →  teams           collection
    3. PlayerScraper        →  players         collection
    4. StatsScraper         →  stats           collection
"""

__version__ = "1.0.0"
__author__  = "Your Name"
