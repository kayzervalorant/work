/**
 * OllamaGate.tsx — Overlay plein écran affiché quand Ollama n'est pas prêt.
 *
 * États gérés :
 *   1. "checking"    — vérification en cours au lancement
 *   2. "no_ollama"   — Ollama n'est pas installé / pas démarré
 *   3. "no_model"    — Ollama tourne mais le modèle n'est pas téléchargé
 *   4. "pulling"     — téléchargement du modèle en cours
 *   5. "ready"       — tout est OK → rend les children normalement
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { checkOllamaStatus, pullModel, openExternalUrl } from "../api/backend";
import type { OllamaStatus, PullEvent } from "../types";

type GateState = "checking" | "no_ollama" | "no_model" | "pulling" | "ready";

interface OllamaGateProps {
  children: React.ReactNode;
}

export default function OllamaGate({ children }: OllamaGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [ollamaInfo, setOllamaInfo] = useState<OllamaStatus | null>(null);
  const [pullProgress, setPullProgress] = useState<PullEvent | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const pullAbortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    setState("checking");
    const status = await checkOllamaStatus();
    setOllamaInfo(status);

    if (!status.ollama_running) {
      setState("no_ollama");
    } else if (!status.model_available) {
      setState("no_model");
    } else {
      setState("ready");
    }
  }, []);

  // Vérification au montage
  useEffect(() => {
    check();
  }, [check]);

  const handlePull = useCallback(async () => {
    setState("pulling");
    setPullProgress(null);
    setPullError(null);

    const controller = new AbortController();
    pullAbortRef.current = controller;

    try {
      await pullModel(
        (event) => setPullProgress(event),
        () => {
          setState("ready");
          setPullProgress(null);
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Erreur lors du téléchargement.";
      setPullError(msg);
      setState("no_model");
    }
  }, []);

  const handleCancelPull = useCallback(() => {
    pullAbortRef.current?.abort();
    setState("no_model");
    setPullProgress(null);
  }, []);

  if (state === "ready") {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base">
      <div className="w-full max-w-md px-8 py-10 flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shadow-glow">
          <EchoLogo size={36} />
        </div>

        {state === "checking" && <CheckingView />}
        {state === "no_ollama" && (
          <NoOllamaView onRetry={check} />
        )}
        {state === "no_model" && (
          <NoModelView
            modelName={ollamaInfo?.model ?? ""}
            onPull={handlePull}
            onRetry={check}
            error={pullError}
          />
        )}
        {state === "pulling" && (
          <PullingView
            modelName={ollamaInfo?.model ?? ""}
            progress={pullProgress}
            onCancel={handleCancelPull}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vues internes
// ---------------------------------------------------------------------------

function CheckingView() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Démarrage d'Echo…</h1>
        <p className="text-sm text-text-muted mt-1">Vérification d'Ollama en cours</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-accent/60 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </>
  );
}

function NoOllamaView({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <div className="w-12 h-12 rounded-full bg-status-offline/10 border border-status-offline/30 flex items-center justify-center">
        <IconOffline />
      </div>

      <div>
        <h1 className="text-lg font-semibold text-text-primary">Ollama non détecté</h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed max-w-sm">
          Echo nécessite <strong className="text-text-secondary">Ollama</strong> pour faire
          tourner le modèle de langage localement sur votre machine.
          Aucune donnée ne quitte votre ordinateur.
        </p>
      </div>

      <div className="w-full space-y-2.5 text-left bg-surface-2 border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          Installation en 2 étapes
        </p>
        <ol className="space-y-2">
          {[
            { step: "1", text: "Téléchargez Ollama sur ollama.com" },
            { step: "2", text: "Lancez l'application Ollama, puis revenez ici" },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-surface-3 border border-border flex items-center justify-center text-[10px] font-bold text-accent shrink-0 mt-0.5">
                {step}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => openExternalUrl("https://ollama.com/download")}
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-lg
            bg-accent text-surface-base font-semibold text-sm
            hover:bg-accent-dim transition-colors
          "
        >
          <IconExternalLink />
          Télécharger Ollama
        </button>
        <button
          onClick={onRetry}
          className="
            w-full px-4 py-2 rounded-lg
            border border-border text-text-secondary text-sm
            hover:bg-surface-2 hover:text-text-primary transition-colors
          "
        >
          Réessayer la détection
        </button>
      </div>

      <p className="text-[11px] text-text-muted flex items-center gap-1.5">
        <IconShield size={11} />
        100% local · Zéro cloud · Open source
      </p>
    </>
  );
}

function NoModelView({
  modelName,
  onPull,
  onRetry,
  error,
}: {
  modelName: string;
  onPull: () => void;
  onRetry: () => void;
  error: string | null;
}) {
  return (
    <>
      <div className="w-12 h-12 rounded-full bg-status-loading/10 border border-status-loading/30 flex items-center justify-center">
        <IconModel />
      </div>

      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          Modèle <code className="text-accent text-base font-mono">{modelName}</code> absent
        </h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Ollama est bien installé, mais le modèle n'a pas encore été téléchargé.
          Le téléchargement s'effectue une seule fois et reste sur votre machine.
        </p>
      </div>

      {error && (
        <div className="w-full px-4 py-3 rounded-lg bg-status-offline/10 border border-status-offline/30 text-sm text-status-offline text-left">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={onPull}
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-lg
            bg-accent text-surface-base font-semibold text-sm
            hover:bg-accent-dim transition-colors
          "
        >
          <IconDownload />
          Télécharger {modelName}
        </button>
        <button
          onClick={onRetry}
          className="
            w-full px-4 py-2 rounded-lg
            border border-border text-text-secondary text-sm
            hover:bg-surface-2 hover:text-text-primary transition-colors
          "
        >
          Vérifier à nouveau
        </button>
      </div>
    </>
  );
}

function PullingView({
  modelName,
  progress,
  onCancel,
}: {
  modelName: string;
  progress: PullEvent | null;
  onCancel: () => void;
}) {
  const pct =
    progress?.total && progress.completed
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  const statusLabel = progress?.status ?? "Initialisation…";
  const isDownloading =
    progress?.total != null && progress?.completed != null;

  const downloadedMb = progress?.completed
    ? (progress.completed / 1_048_576).toFixed(0)
    : null;
  const totalMb = progress?.total
    ? (progress.total / 1_048_576).toFixed(0)
    : null;

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          Téléchargement de{" "}
          <code className="text-accent font-mono text-base">{modelName}</code>
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Cela peut prendre quelques minutes selon votre connexion.
        </p>
      </div>

      <div className="w-full space-y-3">
        {/* Barre de progression */}
        <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: pct != null ? `${pct}%` : "0%" }}
          />
        </div>

        {/* Infos */}
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="truncate max-w-[200px]" title={statusLabel}>
            {statusLabel}
          </span>
          {isDownloading && downloadedMb && totalMb ? (
            <span className="font-mono shrink-0">
              {downloadedMb} / {totalMb} Mo
              {pct != null && ` — ${pct}%`}
            </span>
          ) : (
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-accent/60 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="
          px-4 py-2 rounded-lg border border-border
          text-text-secondary text-sm
          hover:bg-surface-2 hover:text-text-primary transition-colors
        "
      >
        Annuler
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Icons & Logo
// ---------------------------------------------------------------------------

function EchoLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10" stroke="#22d3ee" strokeWidth="1.5" />
      <circle cx="11" cy="11" r="5.5" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.5" />
      <circle cx="11" cy="11" r="2" fill="#22d3ee" />
    </svg>
  );
}

function IconOffline() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="9" />
      <line x1="7" y1="11" x2="15" y2="11" />
    </svg>
  );
}

function IconModel() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="16" height="16" rx="2" />
      <line x1="8" y1="11" x2="14" y2="11" />
      <line x1="11" y1="8" x2="11" y2="14" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 2v8M4.5 7l3 3 3-3" />
      <path d="M2 12h11" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2H2.5A1.5 1.5 0 001 3.5v8A1.5 1.5 0 002.5 13h8A1.5 1.5 0 0012 11.5V8" />
      <path d="M8 1h5v5" />
      <line x1="13" y1="1" x2="6" y2="8" />
    </svg>
  );
}

function IconShield({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="#34d399" strokeWidth="1.2">
      <path d="M6 1L2 2.5V5c0 2.5 2 4 4 5 2-1 4-2.5 4-5V2.5L6 1z" />
    </svg>
  );
}
