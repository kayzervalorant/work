// ---------------------------------------------------------------------------
// Documents & sources
// ---------------------------------------------------------------------------

/** Document source retourné par le backend avec son score de pertinence hybride */
export interface SourceDoc {
  filename: string;
  /** Score hybride [0-1] : cosinus × 0.8 + bonus récence + bonus nom fichier */
  score: number;
}

// ---------------------------------------------------------------------------
// Messages de conversation
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Sources citées par l'IA pour ce message, avec scores */
  source_docs: SourceDoc[];
  streaming?: boolean;
  error?: boolean;
}

/** Format attendu par l'API Ollama pour l'historique */
export interface OllamaHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export type IngestStatus =
  | "pending"
  | "reading"
  | "embedding"
  | "finalizing"
  | "done"
  | "error";

export interface IngestJob {
  id: string;
  status: IngestStatus;
  current_file: string;
  files_done: number;
  files_total: number;
  chunks_total: number;
  error: string;
}

export interface IndexedFolder {
  path: string;
  name: string;
  /** ID du dernier job d'ingestion pour ce dossier */
  job_id?: string;
}

// ---------------------------------------------------------------------------
// Santé du modèle
// ---------------------------------------------------------------------------

export interface ModelStatus {
  connected: boolean;
  model: string;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Ollama pre-flight
// ---------------------------------------------------------------------------

export interface OllamaStatus {
  ollama_running: boolean;
  model: string;
  model_available: boolean;
  available_models: string[];
  error?: string;
}

/** Événement SSE renvoyé par /ollama/pull */
export interface PullEvent {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Notifications UI
// ---------------------------------------------------------------------------

export type ToastKind = "error" | "warning" | "success" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

// ---------------------------------------------------------------------------
// Réponses API
// ---------------------------------------------------------------------------

export interface AskSyncResponse {
  response: string;
  source_docs: SourceDoc[];
}

export interface IngestStartResponse {
  job_id: string;
  status: "pending";
  docs_dir: string;
}
