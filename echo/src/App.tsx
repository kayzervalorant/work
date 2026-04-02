import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import MessageInput from "./components/MessageInput";
import { askStream, checkHealth } from "./api/backend";
import type {
  Message,
  IndexedFolder,
  IngestJob,
  ModelStatus,
  OllamaHistoryMessage,
} from "./types";

let msgCounter = 0;
function uid(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

/** Prépare les N derniers messages pour l'historique Ollama (hors message courant). */
function buildHistory(messages: Message[], maxPairs = 5): OllamaHistoryMessage[] {
  // On prend les N dernières paires user/assistant (= 2*N messages)
  const relevant = messages
    .filter((m) => !m.streaming && !m.error && m.content)
    .slice(-(maxPairs * 2));

  return relevant.map((m) => ({ role: m.role, content: m.content }));
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [folders, setFolders] = useState<IndexedFolder[]>([]);
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    connected: false,
    model: "—",
    loading: true,
  });
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Polling santé Ollama
  useEffect(() => {
    async function poll() {
      const { connected, model } = await checkHealth();
      setModelStatus({ connected, model, loading: false });
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []);

  // Historique calculé à partir des messages existants
  const conversationHistory = useMemo(
    () => buildHistory(messages),
    [messages]
  );

  // -----------------------------------------------------------------------
  // Envoi d'une question
  // -----------------------------------------------------------------------
  const handleSend = useCallback(
    async (question: string) => {
      if (isThinking) return;

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: question,
        source_docs: [],
      };
      const assistantId = uid();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        source_docs: [],
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await askStream(
          question,
          conversationHistory,
          (token) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m
              )
            ),
          (sourceDocs) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, source_docs: sourceDocs } : m
              )
            ),
          () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m
              )
            );
            setIsThinking(false);
          },
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errorText =
          err instanceof Error ? err.message : "Erreur de connexion au backend.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errorText, streaming: false, error: true }
              : m
          )
        );
        setIsThinking(false);
      }
    },
    [isThinking, conversationHistory]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
    setIsThinking(false);
  }, []);

  // -----------------------------------------------------------------------
  // Nouvelle discussion
  // -----------------------------------------------------------------------
  const handleNewChat = useCallback(() => {
    if (isThinking) handleStop();
    setMessages([]);
  }, [isThinking, handleStop]);

  // -----------------------------------------------------------------------
  // Gestion des dossiers
  // -----------------------------------------------------------------------
  const handleFolderAdded = useCallback((folder: IndexedFolder) => {
    setFolders((prev) => {
      const exists = prev.some((f) => f.path === folder.path);
      return exists
        ? prev.map((f) => (f.path === folder.path ? folder : f))
        : [...prev, folder];
    });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-base font-sans select-none">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        folders={folders}
        activeJob={activeJob}
        modelStatus={modelStatus}
        onFolderAdded={handleFolderAdded}
        onJobUpdate={setActiveJob}
      />

      {/* Zone principale */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
              title="Ouvrir la sidebar"
            >
              <IconMenu />
            </button>
          )}

          <span className="text-sm font-medium text-text-secondary">
            Conversation
          </span>

          {/* Compteur de messages */}
          {messages.length > 0 && (
            <span className="text-[11px] text-text-muted">
              {Math.ceil(messages.length / 2)} échange{Math.ceil(messages.length / 2) > 1 ? "s" : ""}
            </span>
          )}

          {/* Bouton Nouvelle discussion */}
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  text-xs text-text-secondary border border-border
                  hover:text-text-primary hover:border-border hover:bg-surface-2
                  transition-all duration-150
                "
                title="Effacer la conversation et démarrer une nouvelle discussion"
              >
                <IconNewChat />
                Nouvelle discussion
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <ChatWindow messages={messages} />

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={!modelStatus.connected}
          isThinking={isThinking}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconNewChat() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M6 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" />
      <line x1="9" y1="1" x2="9" y2="5" />
      <line x1="7" y1="3" x2="11" y2="3" />
    </svg>
  );
}
