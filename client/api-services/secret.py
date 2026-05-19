import os
import urllib.parse
from dotenv import load_dotenv
import hvac
from pymongo import MongoClient

# ==========================================
# 1. LOAD & READ ENVIRONMENT CONFIG
# ==========================================
# Explicitly read variables from your local .env file only
load_dotenv()

# MongoDB Configuration
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
DB_NAME = os.getenv("DB_NAME", "player_analysis_db")

# HashiCorp Vault Configuration
VAULT_URL = os.getenv("VAULT_URL", "http://127.0.0.1:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN")  # Ideally set via systemic env or system role
VAULT_SECRET_PATH = os.getenv("VAULT_SECRET_PATH", "player-analysis/mongo")


# ==========================================
# 2. RETRIEVE CREDENTIALS FROM VAULT
# ==========================================
def get_vault_credentials() -> tuple[str, str]:
    """Authenticates with Vault and extracts MongoDB username and password."""
    if not VAULT_TOKEN:
        raise ValueError("VAULT_TOKEN environment variable is missing!")

    # Initialize HashiCorp Vault client
    vault_client = hvac.Client(url=VAULT_URL, token=VAULT_TOKEN)

    if not vault_client.is_authenticated():
        raise ConnectionError("Failed to authenticate with HashiCorp Vault.")

    try:
        # Assuming KV Secrets Engine Version 2 (standard for modern Vault setups)
        secret_response = vault_client.secrets.kv.v2.read_secret_version(
            path=VAULT_SECRET_PATH
        )
        secrets = secret_response["data"]["data"]
    except Exception as e:
        # Fallback block if your Vault uses older KV Version 1 engines instead
        try:
            secret_response = vault_client.secrets.kv.v1.read_secret(
                path=VAULT_SECRET_PATH
            )
            secrets = secret_response["data"]
        except Exception:
            raise RuntimeError(
                f"Failed to fetch secrets from path '{VAULT_SECRET_PATH}': {e}"
            )

    # Securely retrieve keys
    username = secrets.get("username")
    password = secrets.get("password")

    if not username or not password:
        raise KeyError(
            f"Vault path '{VAULT_SECRET_PATH}' must contain both 'username' and 'password' keys."
        )

    return username, password


# ==========================================
# 3. INITIALIZE MONGO CLIENT
# ==========================================
# Fetch credentials from your secured vault wrapper
db_user, db_pass = get_vault_credentials()

# URL-encode credentials safely to handle special characters (@, :, /, etc.)
encoded_user = urllib.parse.quote_plus(db_user)
encoded_pass = urllib.parse.quote_plus(db_pass)

# Construct standard connection string dynamically
MONGO_URI = f"mongodb://{encoded_user}:{encoded_pass}@{MONGO_HOST}:{MONGO_PORT}/"

# Export database client and instance
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
