import os
from dotenv import load_dotenv

# Charge le fichier .env présent dans le même dossier (silencieux si absent)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# Paths
DOCS_DIR = os.getenv("ECHO_DOCS_DIR", "./docs")
CHROMA_DIR = os.getenv("ECHO_CHROMA_DIR", "./chroma_db")

# Chunking
CHUNK_SIZE = 500        # characters per chunk
CHUNK_OVERLAP = 50      # overlap between chunks

# ChromaDB
COLLECTION_NAME = "echo_documents"

# Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

# Retrieval
TOP_K = 5               # number of chunks to retrieve

# CORS — origines autorisées séparées par des virgules
# tauri://localhost = WebView Tauri (app packagée ou dev)
_raw_origins = os.getenv(
    "ECHO_CORS_ORIGINS",
    "http://localhost:1420,http://localhost:5173,tauri://localhost",
)
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
