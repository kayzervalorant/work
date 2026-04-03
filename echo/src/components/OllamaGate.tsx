/**
 * OllamaGate.tsx — Overlay plein écran affiché au démarrage d'Echo.
 *
 * Flux automatique :
 *   1. "checking"      — vérification en cours
 *   2. "backend_down"  — backend Echo pas encore prêt → auto-retry toutes les 2s
 *   3. "no_ollama"     — Ollama absent → installation automatique disponible
 *   4. "no_model"      — Ollama OK mais modèle absent → téléchargement auto proposé
 *   5. "pulling"       — téléchargement du modèle en cours (SSE + barre %)
 *   6. "ready"         — tout est OK → affiche l'app
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  checkOllamaStatus,
  pullModel,
  openExternalUrl,
  installOllamaAuto,
  startOllamaIfInstalled,
} from "../api/backend";
import type { OllamaStatus, PullEvent } from "../types";

type GateState = "checking" | "backend_down" | "no_ollama" | "no_model" | "pulling" | "ready";
type OllamaInstallState = "idle" | "installing" | "starting" | "error";

const BACKEND_RETRY_INTERVAL_MS = 2_000;
const BACKEND_MAX_RETRIES = 25; // ~50 secondes max

interface OllamaGateProps {
  children: React.ReactNode;
}

export default function OllamaGate({ children }: OllamaGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [ollamaInfo, setOllamaInfo] = useState<OllamaStatus | null>(null);
  const [pullProgress, setPullProgress] = useState<PullEvent | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [backendRetries, setBackendRetries] = useState(0);
  const [installState, setInstallState] = useState<OllamaInstallState>("idle");
  const [installError, setInstallError] = useState<string | null>(null);
  const pullAbortRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // Vérification de l'état Ollama + backend
  // ---------------------------------------------------------------------------

  const check = useCallback(async () => {
    setState("checking");
    const status = await checkOllamaStatus();
    setOllamaInfo(status);

    if (status.error === "BACKEND_UNREACHABLE") {
      setState("backend_down");
    } else if (!status.ollama_running) {
      setState("no_ollama");
    } else if (!status.model_available) {
      setState("no_model");
    } else {
      setState("ready");
    }
  }, []);

  // Vérification initiale au montage
  useEffect(() => {
    check();
  }, [check]);

  // ---------------------------------------------------------------------------
  // Auto-retry quand le backend démarre (state: backend_down)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (state !== "backend_down") {
      setBackendRetries(0);
      return;
    }

    if (backendRetries >= BACKEND_MAX_RETRIES) return; // arrête après timeout

    const id = setTimeout(async () => {
      setBackendRetries((n) => n + 1);
      const status = await checkOllamaStatus();
      setOllamaInfo(status);

      if (status.error === "BACKEND_UNREACHABLE") {
        setState("backend_down"); // reste ici → re-déclenche l'effet
      } else if (!status.ollama_running) {
        setState("no_ollama");
      } else if (!status.model_available) {
        setState("no_model");
      } else {
        setState("ready");
      }
    }, BACKEND_RETRY_INTERVAL_MS);

    return () => clearTimeout(id);
  }, [state, backendRetries]);

  // ---------------------------------------------------------------------------
  // Installation automatique d'Ollama
  // ---------------------------------------------------------------------------

  const handleInstallOllama = useCallback(async () => {
    setInstallState("installing");
    setInstallError(null);
    try {
      await installOllamaAuto();
      setInstallState("starting");
      // Attend qu'Ollama soit prêt (poll)
      setTimeout(() => {
        check();
        setInstallState("idle");
      }, 4_000);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Erreur d'installation.");
      setInstallState("error");
    }
  }, [check]);

  const handleStartOllama = useCallback(async () => {
    setInstallState("starting");
    setInstallError(null);
    const found = await startOllamaIfInstalled();
    if (found) {
      setTimeout(() => {
        check();
        setInstallState("idle");
      }, 3_000);
    } else {
      setInstallState("idle");
      setState("no_ollama");
    }
  }, [check]);

  // ---------------------------------------------------------------------------
  // Téléchargement du modèle
  // ---------------------------------------------------------------------------

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
      setPullError(err instanceof Error ? err.message : "Erreur lors du téléchargement.");
      setState("no_model");
    }
  }, []);

  const handleCancelPull = useCallback(() => {
    pullAbortRef.current?.abort();
    setState("no_model");
    setPullProgress(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (state === "ready") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base">
      <div className="w-full max-w-md px-8 py-10 flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shadow-glow">
          <EchoLogo size={36} />
        </div>

        {state === "checking" && <CheckingView />}

        {state === "backend_down" && (
          <BackendStartingView
            retries={backendRetries}
            maxRetries={BACKEND_MAX_RETRIES}
            onForceRetry={check}
          />
        )}

        {state === "no_ollama" && (
          <NoOllamaView
            installState={installState}
            installError={installError}
            onInstallAuto={handleInstallOllama}
            onStartExisting={handleStartOllama}
            onRetry={check}
          />
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
// Vue : checking
// ---------------------------------------------------------------------------

function CheckingView() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Démarrage d'Echo…</h1>
        <p className="text-sm text-text-muted mt-1">Initialisation en cours</p>
      </div>
      <BounceDots />
    </>
  );
}

// ---------------------------------------------------------------------------
// Vue : backend_down → auto-retry avec spinner
// ---------------------------------------------------------------------------

function BackendStartingView({
  retries,
  maxRetries,
  onForceRetry,
}: {
  retries: number;
  maxRetries: number;
  onForceRetry: () => void;
}) {
  const timedOut = retries >= maxRetries;

  return (
    <>
      {timedOut ? (
        <div className="w-12 h-12 rounded-full bg-status-offline/10 border border-status-offline/30 flex items-center justify-center">
          <IconOffline />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-status-loading/10 border border-status-loading/30 flex items-center justify-center">
          <IconSpinner />
        </div>
      )}

      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          {timedOut ? "Serveur Echo non démarré" : "Démarrage du serveur Echo…"}
        </h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed max-w-sm">
          {timedOut
            ? "Le backend local (port 8000) n'a pas pu démarrer. Vérifiez qu'aucun autre processus n'occupe le port."
            : "Le backend Python démarre automatiquement. Cela peut prendre quelques secondes la première fois (installation des dépendances)."}
        </p>
      </div>

      {!timedOut && (
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <BounceDots />
          <span>Tentative {retries + 1}/{maxRetries}</span>
        </div>
      )}

      {timedOut && (
        <>
          <div className="w-full bg-surface-2 border border-border rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Démarrage manuel (terminal)
            </p>
            <code className="block text-xs font-mono text-accent bg-surface-base rounded-lg px-3 py-2 leading-loose">
              cd echo/backend<br />
              python3 -m venv .venv-dev<br />
              source .venv-dev/bin/activate<br />
              pip install -r requirements.txt<br />
              uvicorn main:app --port 8000
            </code>
          </div>
          <button
            onClick={onForceRetry}
            className="w-full px-4 py-2.5 rounded-lg bg-accent text-surface-base font-semibold text-sm hover:bg-accent-dim transition-colors"
          >
            Réessayer la connexion
          </button>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Vue : no_ollama → installation automatique
// ---------------------------------------------------------------------------

function NoOllamaView({
  installState,
  installError,
  onInstallAuto,
  onStartExisting,
  onRetry,
}: {
  installState: OllamaInstallState;
  installError: string | null;
  onInstallAuto: () => void;
  onStartExisting: () => void;
  onRetry: () => void;
}) {
  const isWorking = installState === "installing" || installState === "starting";

  return (
    <>
      <div className="w-12 h-12 rounded-full bg-status-offline/10 border border-status-offline/30 flex items-center justify-center">
        {isWorking ? <IconSpinner /> : <IconOffline />}
      </div>

      <div>
        <h1 className="text-lg font-semibold text-text-primary">Ollama non détecté</h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed max-w-sm">
          Echo nécessite <strong className="text-text-secondary">Ollama</strong> pour faire
          tourner le modèle de langage localement. Aucune donnée ne quitte votre ordinateur.
        </p>
      </div>

      {installError && (
        <div className="w-full px-4 py-3 rounded-lg bg-status-offline/10 border border-status-offline/30 text-sm text-status-offline text-left">
          {installError}
        </div>
      )}

      {isWorking ? (
        <div className="flex flex-col items-center gap-3">
          <BounceDots />
          <p className="text-sm text-text-muted">
            {installState === "installing"
              ? "Téléchargement et installation d'Ollama… (~150 Mo)"
              : "Démarrage d'Ollama…"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {/* Bouton principal : installation automatique */}
          <button
            onClick={onInstallAuto}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-2.5 rounded-lg
              bg-accent text-surface-base font-semibold text-sm
              hover:bg-accent-dim transition-colors
            "
          >
            <IconDownload />
            Installer Ollama automatiquement
          </button>

          {/* Ollama déjà installé mais pas démarré */}
          <button
            onClick={onStartExisting}
            className="
              w-full px-4 py-2 rounded-lg
              border border-border text-text-secondary text-sm
              hover:bg-surface-2 hover:text-text-primary transition-colors
            "
          >
            Ollama est installé — le démarrer
          </button>

          {/* Fallback manuel */}
          <button
            onClick={() => openExternalUrl("https://ollama.com/download")}
            className="
              w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg
              text-text-muted text-xs hover:text-text-secondary transition-colors
            "
          >
            <IconExternalLink />
            Télécharger manuellement sur ollama.com
          </button>

          <button
            onClick={onRetry}
            className="
              w-full px-4 py-1.5 rounded-lg
              text-text-muted text-xs hover:text-text-secondary transition-colors
            "
          >
            Vérifier à nouveau
          </button>
        </div>
      )}

      <p className="text-[11px] text-text-muted flex items-center gap-1.5">
        <IconShield size={11} />
        100% local · Zéro cloud · Open source
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vue : no_model
// ---------------------------------------------------------------------------

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
          Modèles requis non installés
        </h1>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Echo nécessite deux modèles Ollama : <code className="text-accent font-mono text-xs">{modelName}</code> (chat)
          et <code className="text-accent font-mono text-xs">nomic-embed-text</code> (recherche dans vos documents).
          Le téléchargement s'effectue une seule fois.
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
          Installer les modèles requis
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

// ---------------------------------------------------------------------------
// Vue : pulling
// ---------------------------------------------------------------------------

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
  const isDownloading = progress?.total != null && progress?.completed != null;
  const downloadedMb = progress?.completed ? (progress.completed / 1_048_576).toFixed(0) : null;
  const totalMb = progress?.total ? (progress.total / 1_048_576).toFixed(0) : null;

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
        <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: pct != null ? `${pct}%` : "0%" }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="truncate max-w-[200px]" title={statusLabel}>
            {statusLabel}
          </span>
          {isDownloading && downloadedMb && totalMb ? (
            <span className="font-mono shrink-0">
              {downloadedMb} / {totalMb} Mo{pct != null && ` — ${pct}%`}
            </span>
          ) : (
            <BounceDots />
          )}
        </div>
      </div>

      <button
        onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface-2 hover:text-text-primary transition-colors"
      >
        Annuler
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

function BounceDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-accent/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
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

function IconSpinner() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="9" strokeOpacity="0.25" />
      <path d="M11 2a9 9 0 019 9">
        <animateTransform attributeName="transform" type="rotate" from="0 11 11" to="360 11 11" dur="1s" repeatCount="indefinite" />
      </path>
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
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
