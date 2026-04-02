import os

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
