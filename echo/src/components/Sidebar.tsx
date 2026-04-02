import { useEffect, useRef } from "react";
import DropZone from "./DropZone";
import IngestProgress from "./IngestProgress";
import { startIngest, pollIngestStatus } from "../api/backend";
import type { IndexedFolder, IngestJob, ModelStatus } from "../types";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  folders: IndexedFolder[];
  activeJob: IngestJob | null;
  modelStatus: ModelStatus;
  onFolderAdded: (folder: IndexedFolder) => void;
  onJobUpdate: (job: IngestJob | null) => void;
}

const POLL_INTERVAL_MS = 800;

export default function Sidebar({
  open,
  onToggle,
  folders,
  activeJob,
  modelStatus,
  onFolderAdded,
  onJobUpdate,
}: SidebarProps) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Arrête le polling quand le job est terminé
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === "done" || activeJob.status === "error") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [activeJob]);

  // Nettoyage au démontage
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function handleFolderSelected(path: string) {
    const name = path.split(/[\\/]/).pop() ?? path;

    // Démarre le job asynchrone
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
      return;
    }

    onFolderAdded({ path, name, job_id: resp.job_id });

    // Initialise l'état local du job
    onJobUpdate({
      id: resp.job_id,
      status: "pending",
      current_file: "",
      files_done: 0,
      files_total: 0,
      chunks_total: 0,
      error: "",
    });

    // Démarre le polling
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

            {/* Drag & Drop zone */}
            <DropZone
              onFolderSelected={handleFolderSelected}
              disabled={isIngesting}
            />

            {/* Progression active */}
            {activeJob && (
              <IngestProgress job={activeJob} />
            )}

            {/* Liste des dossiers indexés */}
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
// Folder item
// ---------------------------------------------------------------------------

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
