/**
 * backend.ts — Couche d'intégration avec le serveur FastAPI local (Echo).
 *
 * URL de base : variable d'environnement VITE_API_URL (voir .env.example).
 * Toutes les requêtes restent sur localhost — zéro réseau externe.
 */

// ---------------------------------------------------------------------------
// Types partagés
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: "ok";
  model: string;
}

export interface IngestResponse {
  status: "ok";
  docs_dir: string;
}

/** Événement SSE reçu pendant le streaming */
export type StreamEvent =
  | { sources: string[]; token?: never }
  | { token: string; sources?: never };

export interface AskSyncResponse {
  response: string;
  sources: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Lit VITE_API_URL injecté par Vite au build.
 * Fallback sur localhost:8000 pour la compatibilité sans fichier .env.
 */
const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

function endpoint(path: string): string {
  return `${BASE_URL}${path}`;
}

// ---------------------------------------------------------------------------
// Sélection de dossier (Tauri natif ou fallback navigateur)
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Ouvre le sélecteur de dossier natif (Tauri) ou un prompt navigateur
 * en mode développement hors Tauri.
 */
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
// GET /health — statut Ollama
// ---------------------------------------------------------------------------

/**
 * Vérifie que le backend et Ollama sont disponibles.
 * Timeout court (3 s) pour ne pas bloquer l'UI.
 */
export async function checkHealth(): Promise<{
  connected: boolean;
  model: string;
}> {
  try {
    const res = await fetch(endpoint("/health"), {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return { connected: false, model: "—" };
    const data: HealthResponse = await res.json();
    return { connected: true, model: data.model };
  } catch {
    return { connected: false, model: "—" };
  }
}

// ---------------------------------------------------------------------------
// POST /ingest — indexation d'un dossier
// ---------------------------------------------------------------------------

/**
 * Déclenche l'ingestion d'un dossier côté backend.
 * Lance une exception avec le message d'erreur du backend si échec.
 */
export async function ingestFolder(docsDir: string): Promise<IngestResponse> {
  const res = await fetch(endpoint("/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docs_dir: docsDir }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<IngestResponse>;
}

// ---------------------------------------------------------------------------
// POST /ask — mode streaming (SSE)
// ---------------------------------------------------------------------------

/**
 * Envoie une question et lit la réponse token par token via Server-Sent Events.
 *
 * Séquence SSE émise par le backend :
 *   data: {"sources": ["file.pdf"]}   ← premier événement (liste des sources)
 *   data: {"token": "Bonjour"}        ← un événement par token
 *   data: [DONE]                      ← fin du stream
 *
 * @param question  - Question de l'utilisateur
 * @param onToken   - Appelé pour chaque nouveau token reçu
 * @param onSources - Appelé une fois avec la liste des fichiers sources
 * @param onDone    - Appelé quand le stream est terminé
 * @param signal    - AbortSignal pour interrompre la génération
 */
export async function askStream(
  question: string,
  onToken: (token: string) => void,
  onSources: (sources: string[]) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(endpoint("/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: true }),
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
      // Découpe sur les sauts de ligne SSE
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
          continue; // ligne malformée — on ignore silencieusement
        }

        if (parsed.sources) onSources(parsed.sources);
        if (parsed.token)   onToken(parsed.token);
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

/**
 * Version synchrone : attend la réponse complète avant de retourner.
 * Utile si le streaming est désactivé ou non supporté.
 */
export async function askSync(question: string): Promise<AskSyncResponse> {
  const res = await fetch(endpoint("/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AskSyncResponse>;
}
