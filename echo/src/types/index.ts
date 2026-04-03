// ---------------------------------------------------------------------------
// Documents & sources
// ---------------------------------------------------------------------------

/** Document source retourné par le backend (local ou web) */
export interface SourceDoc {
  filename: string;
  /** Score hybride [0-1] : cosinus × 0.8 + bonus récence + bonus nom fichier */
  score: number;
  /** "local" = fichier sur la machine, "web" = résultat DuckDuckGo */
  type?: "local" | "web";
  /** URL du résultat web (présent uniquement si type === "web") */
  url?: string;
}

// ---------------------------------------------------------------------------
// Messages de conversation
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  source_docs: SourceDoc[];
  streaming?: boolean;
  error?: boolean;
}

export interface IndexedFolder {
  path: string;
  name: string;
  chunks?: number;
}

export interface ModelStatus {
  connected: boolean;
  model: string;
  loading: boolean;
}

export interface AskResponse {
  response: string;
  source_docs: SourceDoc[];
}
