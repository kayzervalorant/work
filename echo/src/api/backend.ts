/**
 * backend.ts — Couche d'intégration avec le serveur FastAPI local (Echo).
 *
 * URL de base : variable d'environnement VITE_API_URL (voir .env.example).
 * Toutes les requêtes restent sur localhost — zéro réseau externe.
 */

import type {
  AskSyncResponse,
  IngestJob,
  IngestStartResponse,
  OllamaHistoryMessage,
  SourceDoc,
} from "../types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

function endpoint(path: string): string {
  return `${BASE_URL}${path}`;
}

// ---------------------------------------------------------------------------
// Sélection de dossier (Tauri natif ou fallback navigateur)
// ---------------------------------------------------------------------------

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function selectFolder(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/api/dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Sélectionner un dossier de documents",
    });
    return typeof selected === "string" ? selected : null;
  }
  return window.prompt("Chemin du dossier à indexer (dev sans Tauri) :");
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{ connected: boolean; model: string }> {
  try {
    const res = await fetch(endpoint("/health"), {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return { connected: false, model: "—" };
    const data = await res.json() as { status: string; model: string };
    return { connected: true, model: data.model };
  } catch {
    return { connected: false, model: "—" };
  }
}

// ---------------------------------------------------------------------------
// POST /ingest — démarre l'ingestion asynchrone, retourne un job_id
// ---------------------------------------------------------------------------

export async function startIngest(docsDir: string): Promise<IngestStartResponse> {
  const res = await fetch(endpoint("/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docs_dir: docsDir }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<IngestStartResponse>;
}

// ---------------------------------------------------------------------------
// GET /ingest/status/{job_id} — état courant d'un job
// ---------------------------------------------------------------------------

export async function pollIngestStatus(jobId: string): Promise<IngestJob> {
  const res = await fetch(endpoint(`/ingest/status/${jobId}`), {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<IngestJob>;
}

// ---------------------------------------------------------------------------
// POST /ask — mode streaming (SSE)
// ---------------------------------------------------------------------------

/**
 * Événement SSE discriminé :
 *   {"source_docs": [...]}  — premier événement, une seule fois
 *   {"token": str}          — répété pour chaque token
 */
type StreamEvent =
  | { source_docs: SourceDoc[]; token?: never }
  | { token: string; source_docs?: never };

/**
 * Envoie une question et lit la réponse token par token.
 *
 * @param question   Question de l'utilisateur
 * @param history    Historique Ollama (derniers N messages user/assistant)
 * @param onToken    Appelé à chaque nouveau token
 * @param onSources  Appelé une fois avec les documents sources + scores
 * @param onDone     Appelé en fin de stream
 * @param signal     AbortSignal pour interrompre la génération
 */
export async function askStream(
  question: string,
  history: OllamaHistoryMessage[],
  onToken: (token: string) => void,
  onSources: (sourceDocs: SourceDoc[]) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(endpoint("/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: true, history }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("ReadableStream non disponible.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();

        if (raw === "[DONE]") {
          onDone();
          return;
        }

        let parsed: StreamEvent;
        try {
          parsed = JSON.parse(raw) as StreamEvent;
        } catch {
          continue;
        }

        if (parsed.source_docs) onSources(parsed.source_docs);
        if (parsed.token)       onToken(parsed.token);
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
}

// ---------------------------------------------------------------------------
// POST /ask — mode non-streaming (fallback)
// ---------------------------------------------------------------------------

export async function askSync(
  question: string,
  history: OllamaHistoryMessage[]
): Promise<AskSyncResponse> {
  const res = await fetch(endpoint("/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: false, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AskSyncResponse>;
}
