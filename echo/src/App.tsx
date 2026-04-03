import { useState, useCallback, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import MessageInput from "./components/MessageInput";
import { askStream, checkHealth } from "./api/backend";
import type { Message, IndexedFolder, ModelStatus } from "./types";

let msgCounter = 0;
function uid(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [folders, setFolders] = useState<IndexedFolder[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    connected: false,
    model: "—",
    loading: true,
  });
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Vérification initiale + polling toutes les 10s
  useEffect(() => {
    async function poll() {
      const { connected, model } = await checkHealth();
      setModelStatus({ connected, model, loading: false });
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []);

  const handleSend = useCallback(
    async (question: string) => {
      if (isThinking) return;

      // Message utilisateur
      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: question,
        source_docs: [],
      };

      // Placeholder message assistant (streaming)
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
          (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m
              )
            );
          },
          (source_docs) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, source_docs } : m
              )
            );
          },
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
    [isThinking]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
    setIsThinking(false);
  }, []);

  const handleFolderAdded = useCallback((folder: IndexedFolder) => {
    setFolders((prev) => {
      const exists = prev.some((f) => f.path === folder.path);
      return exists ? prev : [...prev, folder];
    });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-base font-sans select-none">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        folders={folders}
        modelStatus={modelStatus}
        onFolderAdded={handleFolderAdded}
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
            <button
              onClick={() => setMessages([])}
              className="ml-auto text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Effacer
            </button>
          )}
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

function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  );
}
