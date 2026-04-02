/**
 * backend.ts — Couche d'intégration avec le serveur FastAPI local.
 * Toutes les requêtes restent sur http://localhost:8000 — zéro réseau externe.
 */

const BASE_URL = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Sélection de dossier (Tauri natif ou fallback navigateur)
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function selectFolder(): Promise<string | null> {
  if (isTauri()) {
    // Import dynamique pour ne pas crasher hors Tauri
    const { open } = await import("@tauri-apps/api/dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Sélectionner un dossier de documents",
    });
    return typeof selected === "string" ? selected : null;
  }
  // Fallback navigateur (dev sans Tauri)
  return window.prompt("Chemin du dossier à indexer :");
}

// ---------------------------------------------------------------------------
// Health check — statut du modèle Ollama
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{ connected: boolean; model: string }> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false, model: "—" };
    const data = await res.json();
    return { connected: true, model: data.model ?? "—" };
  } catch {
    return { connected: false, model: "—" };
  }
}

// ---------------------------------------------------------------------------
// Ingestion d'un dossier
// ---------------------------------------------------------------------------

export async function ingestFolder(docsDir: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docs_dir: docsDir }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Question — mode streaming (SSE)
// ---------------------------------------------------------------------------

export async function askStream(
  question: string,
  onToken: (token: string) => void,
  onSources: (sources: string[]) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: true }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
      try {
        const parsed = JSON.parse(raw);
        if (parsed.sources) onSources(parsed.sources as string[]);
        if (parsed.token) onToken(parsed.token as string);
      } catch {
        // ligne malformée — on ignore
      }
    }
  }

  onDone();
}

// ---------------------------------------------------------------------------
// Question — mode non-streaming (fallback)
// ---------------------------------------------------------------------------

export async function askSync(question: string): Promise<{ response: string; sources: string[] }> {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}
