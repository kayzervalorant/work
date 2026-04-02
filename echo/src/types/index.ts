export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[];
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
  sources: string[];
}
