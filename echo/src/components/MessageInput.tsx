import { useState, useRef, useCallback, KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (question: string) => void;
  onStop: () => void;
  disabled: boolean;
  isThinking: boolean;
}

export default function MessageInput({
  onSend,
  onStop,
  disabled,
  isThinking,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  const handleSubmit = useCallback(() => {
    const question = value.trim();
    if (!question || disabled || isThinking) return;
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(question);
  }, [value, disabled, isThinking, onSend]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const canSend = value.trim().length > 0 && !disabled && !isThinking;

  return (
    <div className="px-4 pb-4 pt-2 shrink-0">
      {/* Barre de saisie */}
      <div
        className={`
          relative flex items-end gap-2
          bg-surface-2 border rounded-2xl px-4 py-3
          transition-all duration-200
          ${disabled
            ? "border-border opacity-60"
            : "border-border hover:border-border focus-within:border-accent/50 focus-within:shadow-glow"
          }
        `}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Ollama non connecté — démarrez Ollama d'abord"
              : "Posez une question sur vos documents…"
          }
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none bg-transparent outline-none
            text-sm text-text-primary placeholder:text-text-muted
            leading-relaxed py-0.5
            min-h-[24px] max-h-[160px]
            disabled:cursor-not-allowed
          "
        />

        {/* Boutons actions */}
        <div className="flex items-center gap-2 shrink-0 pb-0.5">
          {/* Shift+Enter hint */}
          {value.length > 0 && !isThinking && (
            <span className="text-[10px] text-text-muted hidden sm:block">
              ⇧ Entrée pour saut de ligne
            </span>
          )}

          {/* Bouton stop (pendant streaming) */}
          {isThinking && (
            <button
              onClick={onStop}
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                text-xs text-status-offline border border-status-offline/30
                hover:bg-status-offline/10 transition-colors
              "
              title="Arrêter la génération"
            >
              <IconStop />
              Stop
            </button>
          )}

          {/* Bouton envoyer */}
          {!isThinking && (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`
                w-8 h-8 rounded-xl flex items-center justify-center
                transition-all duration-200
                ${canSend
                  ? "bg-accent text-surface-base hover:bg-accent/90 shadow-glow"
                  : "bg-surface-3 text-text-muted cursor-not-allowed"
                }
              `}
              title="Envoyer (Entrée)"
            >
              <IconSend />
            </button>
          )}

          {/* Spinner pendant génération */}
          {isThinking && (
            <div className="w-8 h-8 flex items-center justify-center">
              <IconSpinner />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-1.5 text-center text-[10px] text-text-muted">
        Echo traite vos données localement · aucune donnée envoyée sur internet
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="7" x2="13" y2="7" />
      <polyline points="7,1 13,7 7,13" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="1.5"
      className="animate-spin"
    >
      <circle cx="8" cy="8" r="6" strokeOpacity="0.15" />
      <path d="M8 2A6 6 0 0114 8" strokeLinecap="round" />
    </svg>
  );
}
