from server.db.mongo import MongoRepository
from server.config import settings

# Temporary cleanup task execution
class StatsRepository(MongoRepository):
    collection_name = settings.stats_collection

with StatsRepository() as repo:
    # Danger: Drops all cached documents so the scraper can re-populate them cleanly
    result = repo.col.delete_many({})
    print(f"Successfully purged {result.deleted_count} corrupted stat rows.")
