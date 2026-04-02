import { useState, useEffect, useRef } from "react";
import DropZone from "./DropZone";
import IngestProgress from "./IngestProgress";
import { startIngest, pollIngestStatus, resetDatabase } from "../api/backend";
import type { IndexedFolder, IngestJob, ModelStatus, ToastKind } from "../types";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  folders: IndexedFolder[];
  activeJob: IngestJob | null;
  modelStatus: ModelStatus;
  onFolderAdded: (folder: IndexedFolder) => void;
  onFolderRemoved: (path: string) => void;
  onJobUpdate: (job: IngestJob | null) => void;
  onToast: (message: string, kind?: ToastKind) => void;
}

const POLL_INTERVAL_MS = 800;

export default function Sidebar({
  open,
  onToggle,
  folders,
  activeJob,
  modelStatus,
  onFolderAdded,
  onFolderRemoved,
  onJobUpdate,
  onToast,
}: SidebarProps) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Arrête le polling quand le job est terminé
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === "done" || activeJob.status === "error") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (activeJob.status === "done") {
        onToast(`Indexation terminée — ${activeJob.chunks_total} chunks.`, "success");
      } else if (activeJob.status === "error" && activeJob.error) {
        onToast(`Erreur d'indexation : ${activeJob.error}`, "error");
      }
    }
  }, [activeJob, onToast]);

  // Nettoyage au démontage
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function handleFolderSelected(path: string) {
    const name = path.split(/[\\/]/).pop() ?? path;

    let resp;
    try {
      resp = await startIngest(path);
    } catch (err) {
      onJobUpdate({
        id: "err",
        status: "error",
        current_file: "",
        files_done: 0,
        files_total: 0,
        chunks_total: 0,
        error: err instanceof Error ? err.message : "Erreur de démarrage.",
      });
      onToast(
        err instanceof Error ? err.message : "Impossible de démarrer l'indexation.",
        "error"
      );
      return;
    }

    onFolderAdded({ path, name, job_id: resp.job_id });
    onJobUpdate({
      id: resp.job_id,
      status: "pending",
      current_file: "",
      files_done: 0,
      files_total: 0,
      chunks_total: 0,
      error: "",
    });

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await pollIngestStatus(resp.job_id);
        onJobUpdate(updated);
        if (updated.status === "done" || updated.status === "error") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {
        // Polling failure silencieuse — on réessaiera au prochain tick
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleNuclearReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setResetting(true);
    setConfirmReset(false);
    try {
      await resetDatabase();
      // Vide l'état local
      folders.forEach((f) => onFolderRemoved(f.path));
      onJobUpdate(null);
      onToast("Base de données réinitialisée. Toutes les données indexées ont été supprimées.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Erreur lors de la réinitialisation.",
        "error"
      );
    } finally {
      setResetting(false);
    }
  }

  const isIngesting =
    activeJob !== null &&
    activeJob.status !== "done" &&
    activeJob.status !== "error";

  return (
    <aside
      className={`
        flex flex-col shrink-0 h-full border-r border-border
        bg-surface-1 transition-all duration-300 ease-in-out overflow-hidden
        ${open ? "w-64" : "w-0"}
      `}
    >
      <div className="flex flex-col w-64 h-full">
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <EchoLogo />
            <span className="text-sm font-semibold tracking-wide text-text-primary">
              Echo
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            title="Fermer la sidebar"
          >
            <IconChevronLeft />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Section sources */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Sources de données
              </span>
              <span className="flex items-center gap-1 text-[10px] text-status-online">
                <IconLock size={10} />
                Local
              </span>
            </div>

            <DropZone
              onFolderSelected={handleFolderSelected}
              disabled={isIngesting}
            />

            {activeJob && <IngestProgress job={activeJob} />}

            {folders.length > 0 && (
              <ul className="space-y-1 pt-1">
                {folders.map((f) => (
                  <FolderItem
                    key={f.path}
                    folder={f}
                    active={isIngesting && activeJob?.id === f.job_id}
                  />
                ))}
              </ul>
            )}

            {folders.length === 0 && !activeJob && (
              <p className="px-1 text-xs text-text-muted leading-relaxed">
                Aucun dossier indexé.<br />
                Glissez vos PDF et Markdown ci-dessus.
              </p>
            )}
          </section>

          {/* Section Paramètres */}
          <section className="space-y-2">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="
                flex items-center justify-between w-full px-1 py-0.5
                text-[11px] font-semibold uppercase tracking-widest text-text-muted
                hover:text-text-secondary transition-colors
              "
            >
              <span>Paramètres</span>
              <IconChevronDown
                className={`transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {settingsOpen && (
              <div className="space-y-3 pt-1 animate-fade-in">
                {/* Nuclear Reset */}
                <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      <IconNuclear />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-secondary">
                        Réinitialisation complète
                      </p>
                      <p className="text-[10px] text-text-muted leading-relaxed mt-0.5">
                        Supprime toutes les données vectorielles indexées.
                        Irréversible.
                      </p>
                    </div>
                  </div>

                  {confirmReset ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-status-offline font-medium px-0.5">
                        Confirmer la suppression ?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleNuclearReset}
                          disabled={resetting}
                          className="
                            flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                            bg-status-offline/20 text-status-offline border border-status-offline/40
                            hover:bg-status-offline/30 disabled:opacity-50 transition-colors
                          "
                        >
                          {resetting ? "Suppression…" : "Oui, supprimer"}
                        </button>
                        <button
                          onClick={() => setConfirmReset(false)}
                          disabled={resetting}
                          className="
                            flex-1 px-2 py-1.5 rounded-lg text-[11px]
                            border border-border text-text-secondary
                            hover:bg-surface-3 disabled:opacity-50 transition-colors
                          "
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleNuclearReset}
                      disabled={isIngesting || resetting}
                      className="
                        w-full flex items-center justify-center gap-2
                        px-3 py-1.5 rounded-lg text-[11px] font-medium
                        border border-status-offline/30 text-status-offline
                        hover:bg-status-offline/10 hover:border-status-offline/50
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-colors
                      "
                      title={isIngesting ? "Attendez la fin de l'indexation" : "Supprimer toutes les données indexées"}
                    >
                      <IconTrash />
                      Nuclear Reset
                    </button>
                  )}
                </div>

                {/* Infos version */}
                <div className="px-1 space-y-1">
                  <InfoRow label="Modèle" value={modelStatus.model} />
                  <InfoRow label="Version" value="0.1.0" />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Pied — statut modèle */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`
                w-2 h-2 rounded-full shrink-0
                ${
                  modelStatus.loading
                    ? "bg-status-loading animate-pulse-slow"
                    : modelStatus.connected
                    ? "bg-status-online"
                    : "bg-status-offline"
                }
              `}
            />
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted leading-none mb-0.5">Ollama</p>
              <p className="text-xs font-medium text-text-secondary truncate">
                {modelStatus.loading
                  ? "Connexion…"
                  : modelStatus.connected
                  ? modelStatus.model
                  : "Non connecté"}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface-2">
            <IconShield />
            <span className="text-[10px] text-text-muted leading-tight">
              100% local · Zéro cloud
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-muted">{label}</span>
      <span className="text-[10px] font-mono text-text-secondary">{value}</span>
    </div>
  );
}

function FolderItem({
  folder,
  active,
}: {
  folder: IndexedFolder;
  active: boolean;
}) {
  return (
    <li
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-md
        ${active ? "bg-surface-3" : "hover:bg-surface-2"}
        transition-colors cursor-default group
      `}
    >
      <IconFolder className="shrink-0 text-accent/70" />
      <span
        className="text-xs text-text-secondary truncate flex-1"
        title={folder.path}
      >
        {folder.name}
      </span>
      <IconLock
        size={11}
        className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function EchoLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10" stroke="#22d3ee" strokeWidth="1.5" />
      <circle cx="11" cy="11" r="5.5" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.5" />
      <circle cx="11" cy="11" r="2" fill="#22d3ee" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="9,2 4,7 9,12" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <polyline points="2,4 6,8 10,4" />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" className={className}>
      <path d="M1 3.5A1.5 1.5 0 012.5 2h2.586a1 1 0 01.707.293L7 3.5H11.5A1.5 1.5 0 0113 5v5.5A1.5 1.5 0 0111.5 12h-9A1.5 1.5 0 011 10.5V3.5z" />
    </svg>
  );
}

function IconLock({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
      <rect x="1.5" y="5.5" width="9" height="6" rx="1" />
      <path d="M3.5 5.5V3.5a2.5 2.5 0 015 0v2" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#34d399" strokeWidth="1.2">
      <path d="M5.5 1L1.5 2.5V5c0 2.5 2 4 4 5 2-1 4-2.5 4-5V2.5L5.5 1z" />
    </svg>
  );
}

function IconNuclear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f87171" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 5V2" />
      <path d="M7 12v-3" />
      <path d="M5 6L2.5 4.3" />
      <path d="M11.5 9.7L9 8" />
      <path d="M5 8L2.5 9.7" />
      <path d="M11.5 4.3L9 6" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,3 11,3" />
      <path d="M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1" />
      <path d="M2 3l.7 7.5A1 1 0 003.7 11h4.6a1 1 0 001-.5L10 3" />
    </svg>
  );
}
