import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import type { Message, SourceDoc } from "../types";
import { openExternalUrl } from "../api/backend";

interface ChatWindowProps {
  messages: Message[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 overflow-y-auto">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 selectable">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <AssistantMessage key={msg.id} message={msg} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message utilisateur
// ---------------------------------------------------------------------------

function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[75%] flex flex-col items-end gap-1">
        <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-accent/15 border border-accent/20 text-text-primary text-sm leading-relaxed">
          {message.content}
        </div>
        <span className="text-[10px] text-text-muted px-1">Vous</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message assistant
// ---------------------------------------------------------------------------

function AssistantMessage({ message }: { message: Message }) {
  const isEmpty = !message.content && message.streaming;

  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center mt-0.5">
        <EchoAvatarIcon />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <span className="text-[10px] text-text-muted font-medium">Echo</span>

        <div
          className={`
            px-4 py-3 rounded-2xl rounded-tl-sm bg-surface-2 border text-sm leading-relaxed
            ${message.error
              ? "border-status-offline/30 text-status-offline"
              : "border-border text-text-primary"
            }
          `}
        >
          {isEmpty ? (
            <ThinkingDots />
          ) : (
            <MarkdownContent content={message.content} />
          )}
          {message.streaming && !isEmpty && (
            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-middle animate-blink" />
          )}
        </div>

        {/* Cartes sources avec scores */}
        {message.source_docs.length > 0 && !message.streaming && (
          <SourceCards sourceDocs={message.source_docs} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source cards — locales et web
// ---------------------------------------------------------------------------

function SourceCards({ sourceDocs }: { sourceDocs: SourceDoc[] }) {
  const localDocs = sourceDocs.filter((d) => d.type !== "web");
  const webDocs = sourceDocs.filter((d) => d.type === "web");

  return (
    <div className="space-y-2 pt-1 animate-fade-in">
      {localDocs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted px-0.5 uppercase tracking-wider font-medium">
            Documents locaux
          </p>
          <div className="flex flex-col gap-1.5">
            {localDocs.map((doc) => (
              <LocalSourceCard key={doc.filename} doc={doc} />
            ))}
          </div>
        </div>
      )}
      {webDocs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted px-0.5 uppercase tracking-wider font-medium">
            Sources web
          </p>
          <div className="flex flex-col gap-1.5">
            {webDocs.map((doc) => (
              <WebSourceCard key={doc.url ?? doc.filename} doc={doc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocalSourceCard({ doc }: { doc: SourceDoc }) {
  const pct = Math.round(doc.score * 100);
  const scoreColor =
    pct >= 80
      ? "text-status-online"
      : pct >= 60
      ? "text-accent"
      : "text-status-loading";

  return (
    <div
      className="
        flex items-center gap-2.5 px-3 py-2
        rounded-lg border border-border bg-surface-3
        hover:border-accent/40
        transition-colors cursor-default group
      "
      title={`Score de pertinence : ${pct}%`}
    >
      <div className="shrink-0 text-text-muted group-hover:text-accent transition-colors">
        <IconFile />
      </div>
      <span className="flex-1 text-xs text-text-secondary truncate group-hover:text-text-primary transition-colors">
        {doc.filename}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-12 h-1 rounded-full bg-surface-base overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 80
                ? "bg-status-online"
                : pct >= 60
                ? "bg-accent"
                : "bg-status-loading"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] font-mono font-medium w-8 text-right ${scoreColor}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function WebSourceCard({ doc }: { doc: SourceDoc }) {
  function handleClick() {
    if (doc.url) openExternalUrl(doc.url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="
        flex items-center gap-2.5 px-3 py-2 w-full text-left
        rounded-lg border border-border bg-surface-3
        hover:border-blue-400/40
        transition-colors cursor-pointer group
      "
      title={doc.url}
    >
      <div className="shrink-0 text-blue-400/70 group-hover:text-blue-400 transition-colors">
        <IconGlobe />
      </div>
      <span className="flex-1 text-xs text-text-secondary truncate group-hover:text-text-primary transition-colors">
        {doc.filename}
      </span>
      <div className="shrink-0 text-text-muted group-hover:text-blue-400 transition-colors">
        <IconExternalLink />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Rendu Markdown
// ---------------------------------------------------------------------------

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h1 className="text-base font-semibold mb-2 text-text-primary">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 text-text-primary">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-text-secondary">{children}</h3>,
        ul: ({ children }) => <ul className="list-none space-y-1 mb-2 pl-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-1">{children}</ol>,
        li: ({ children }) => (
          <li className="flex gap-2 text-sm leading-relaxed">
            <span className="text-accent mt-1.5 shrink-0">·</span>
            <span>{children}</span>
          </li>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className="block text-xs font-mono bg-surface-base border border-border rounded-md px-3 py-2 my-2 overflow-x-auto text-accent/90 whitespace-pre">
                {children}
              </code>
            );
          }
          return (
            <code className="text-xs font-mono bg-surface-base border border-border rounded px-1.5 py-0.5 text-accent/90">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="my-2 rounded-md overflow-hidden">{children}</pre>,
        strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
        em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
        hr: () => <hr className="border-border my-3" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent/40 pl-3 my-2 text-text-secondary italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="text-center space-y-4 max-w-sm">
      <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="5.5" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="11" cy="11" r="2" fill="#22d3ee" />
        </svg>
      </div>
      <div>
        <p className="text-text-primary font-medium text-sm">Comment puis-je vous aider ?</p>
        <p className="text-text-muted text-xs mt-1.5 leading-relaxed">
          Posez une question sur vos documents ou sur n'importe quel sujet.<br />
          Echo combine vos fichiers locaux et le web pour répondre.
        </p>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-status-online">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#34d399" strokeWidth="1.2">
          <path d="M5 1L1.5 2.2V4.5c0 2.2 1.8 3.5 3.5 4.4 1.7-.9 3.5-2.2 3.5-4.4V2.2L5 1z" />
        </svg>
        Données 100% locales · Zéro cloud
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking dots
// ---------------------------------------------------------------------------

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1 h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function EchoAvatarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="#22d3ee" strokeWidth="1" />
      <circle cx="6.5" cy="6.5" r="2" fill="#22d3ee" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2.5 1.5h5.5l2.5 2.5v7.5h-8V1.5z" />
      <line x1="4.5" y1="6" x2="8.5" y2="6" />
      <line x1="4.5" y1="8" x2="8.5" y2="8" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="6.5" cy="6.5" r="5" />
      <ellipse cx="6.5" cy="6.5" rx="2.2" ry="5" />
      <line x1="1.5" y1="6.5" x2="11.5" y2="6.5" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M4.5 2H2a.5.5 0 0 0-.5.5v6.5A.5.5 0 0 0 2 9.5h6.5A.5.5 0 0 0 9 9V6.5" />
      <path d="M6 1.5h3.5V5" />
      <line x1="9.5" y1="1.5" x2="5" y2="6" />
    </svg>
  );
}
