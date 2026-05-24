"""
create_indexes.py - Create database indexes for performance optimization
"""

from db import db

def create_indexes():
    """Create all necessary indexes for the hockey dashboard"""
    
    print("Creating indexes on 'stats' collection...")
    
    # Create indexes on stats collection
    indexes_stats = [
        [("season", 1)],
        [("league", 1)],
        [("position", 1)],
        [("player_name", 1)],
        [("team", 1)],
        [("player_url", 1)],  # For the lookup join
        [("season", 1), ("league", 1)],  # Compound index for common filters
    ]
    
    for index_fields in indexes_stats:
        try:
            index_name = db.stats.create_index(index_fields)
            print(f"  ✓ Created index: {index_name}")
        except Exception as e:
            print(f"  ✗ Error creating index {index_fields}: {e}")
    
    print("\nCreating indexes on 'players' collection...")
    
    # Create indexes on players collection
    indexes_players = [
        [("url", 1)],  # For the lookup join
    ]
    
    for index_fields in indexes_players:
        try:
            index_name = db.players.create_index(index_fields)
            print(f"  ✓ Created index: {index_name}")
        except Exception as e:
            print(f"  ✗ Error creating index {index_fields}: {e}")
    
    print("\n✓ Index creation complete!")
    
    # List all indexes
    print("\nExisting indexes on 'stats' collection:")
    for index in db.stats.list_indexes():
        print(f"  - {index['name']}: {index['key']}")

if __name__ == "__main__":
    create_indexes()
