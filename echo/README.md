# Echo — Assistant personnel local & privacy-first

> RAG local : Tauri + React + Python + ChromaDB + Ollama

## Architecture

```
echo/
├── src/                        # Frontend React + Tailwind
│   ├── components/
│   │   ├── ChatWindow.tsx      # Affichage des messages (streaming)
│   │   ├── MessageInput.tsx    # Zone de saisie
│   │   └── DocumentList.tsx    # Liste des docs ingérés
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                  # Shell Tauri (Rust)
│   ├── src/main.rs
│   └── tauri.conf.json
├── backend/                    # API Python locale
│   ├── main.py                 # Serveur FastAPI
│   ├── ingest.py               # Lecture + chunking + vectorisation
│   ├── query.py                # Retrieval + génération Ollama
│   ├── config.py               # Configuration centralisée
│   └── requirements.txt
├── docs/                       # Dossier des documents utilisateur
└── chroma_db/                  # Base vectorielle persistante (auto-créé)
```

## Prérequis

- [Ollama](https://ollama.ai) installé et démarré
- Modèles téléchargés :
  ```bash
  ollama pull mistral
  ollama pull nomic-embed-text
  ```
- Python 3.11+
- Node.js 18+ et Rust (pour Tauri)

## Démarrage rapide

### 1. Backend Python
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

### 2. Ingérer vos documents
Placez vos fichiers `.md` et `.pdf` dans `docs/`, puis :
```bash
cd backend
python ingest.py
```
Ou via l'API :
```bash
curl -X POST http://localhost:8000/ingest -H "Content-Type: application/json" \
  -d '{"docs_dir": "./docs"}'
```

### 3. Poser une question
```bash
python query.py "Quel est le sujet principal de mes notes ?"
```
Ou via l'API :
```bash
curl -X POST http://localhost:8000/ask -H "Content-Type: application/json" \
  -d '{"question": "Résume mes documents", "stream": false}'
```

### 4. Frontend Tauri
```bash
npm install
npm run tauri dev
```

## Variables d'environnement

| Variable             | Défaut                  | Description                  |
|----------------------|-------------------------|------------------------------|
| `ECHO_DOCS_DIR`      | `./docs`                | Dossier des documents        |
| `ECHO_CHROMA_DIR`    | `./chroma_db`           | Persistance ChromaDB         |
| `OLLAMA_BASE_URL`    | `http://localhost:11434`| URL d'Ollama                 |
| `OLLAMA_MODEL`       | `mistral`               | Modèle de génération         |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text`      | Modèle d'embeddings          |
