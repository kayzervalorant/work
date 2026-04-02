import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import MessageInput from "./components/MessageInput";
import OllamaGate from "./components/OllamaGate";
import ToastContainer from "./components/Toast";
import { askStream, checkHealth } from "./api/backend";
import type {
  Message,
  IndexedFolder,
  IngestJob,
  ModelStatus,
  OllamaHistoryMessage,
  Toast,
  ToastKind,
} from "./types";

let msgCounter = 0;
function uid(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

let toastCounter = 0;
function toastId(): string {
  return `toast-${Date.now()}-${++toastCounter}`;
}

/** Prépare les N derniers messages pour l'historique Ollama (hors message courant). */
function buildHistory(messages: Message[], maxPairs = 5): OllamaHistoryMessage[] {
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------
  const addToast = useCallback((message: string, kind: ToastKind = "error") => {
    setToasts((prev) => [...prev, { id: toastId(), kind, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // Polling santé Ollama
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Envoi d'une question
  // ---------------------------------------------------------------------------
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
        addToast(errorText, "error");
        setIsThinking(false);
      }
    },
    [isThinking, conversationHistory, addToast]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
    setIsThinking(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Nouvelle discussion
  // ---------------------------------------------------------------------------
  const handleNewChat = useCallback(() => {
    if (isThinking) handleStop();
    setMessages([]);
  }, [isThinking, handleStop]);

  // ---------------------------------------------------------------------------
  // Gestion des dossiers
  // ---------------------------------------------------------------------------
  const handleFolderAdded = useCallback((folder: IndexedFolder) => {
    setFolders((prev) => {
      const exists = prev.some((f) => f.path === folder.path);
      return exists
        ? prev.map((f) => (f.path === folder.path ? folder : f))
        : [...prev, folder];
    });
  }, []);

  const handleFolderRemoved = useCallback((path: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== path));
  }, []);

  return (
    <OllamaGate>
      <div className="flex h-screen w-screen overflow-hidden bg-surface-base font-sans select-none">
        {/* Notifications */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />

        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          folders={folders}
          activeJob={activeJob}
          modelStatus={modelStatus}
          onFolderAdded={handleFolderAdded}
          onFolderRemoved={handleFolderRemoved}
          onJobUpdate={setActiveJob}
          onToast={addToast}
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

            {messages.length > 0 && (
              <span className="text-[11px] text-text-muted">
                {Math.ceil(messages.length / 2)} échange{Math.ceil(messages.length / 2) > 1 ? "s" : ""}
              </span>
            )}

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
    </OllamaGate>
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
