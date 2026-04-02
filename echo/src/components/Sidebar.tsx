import { useState } from "react";
import { selectFolder, ingestFolder } from "../api/backend";
import type { IndexedFolder, ModelStatus } from "../types";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  folders: IndexedFolder[];
  modelStatus: ModelStatus;
  onFolderAdded: (folder: IndexedFolder) => void;
}

export default function Sidebar({
  open,
  onToggle,
  folders,
  modelStatus,
  onFolderAdded,
}: SidebarProps) {
  const [ingestingPath, setIngestingPath] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  async function handleAddFolder() {
    setIngestError(null);
    const path = await selectFolder();
    if (!path) return;

    const name = path.split(/[\\/]/).pop() ?? path;
    setIngestingPath(path);
    try {
      await ingestFolder(path);
      onFolderAdded({ path, name });
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Erreur d'ingestion.");
    } finally {
      setIngestingPath(null);
    }
  }

  return (
    <aside
      className={`
        flex flex-col shrink-0 h-full border-r border-border
        bg-surface-1 transition-all duration-300 ease-in-out overflow-hidden
        ${open ? "w-64" : "w-0"}
      `}
    >
      {/* Inner wrapper — évite le clipping pendant l'animation */}
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

        {/* Sources de données */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Sources de données
              </span>
              <span className="flex items-center gap-1 text-[10px] text-status-online">
                <IconLock size={10} />
                Local
              </span>
            </div>

            {/* Bouton ajouter */}
            <button
              onClick={handleAddFolder}
              disabled={!!ingestingPath}
              className="
                w-full flex items-center gap-2 px-3 py-2 rounded-lg
                border border-dashed border-border text-text-secondary
                hover:border-accent hover:text-accent hover:bg-accent/5
                transition-all duration-200 text-sm
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {ingestingPath ? (
                <>
                  <IconSpinner />
                  <span className="truncate text-xs">Indexation…</span>
                </>
              ) : (
                <>
                  <IconPlus />
                  <span>Ajouter un dossier</span>
                </>
              )}
            </button>

            {/* Erreur ingestion */}
            {ingestError && (
              <p className="mt-2 px-1 text-xs text-status-offline leading-relaxed">
                {ingestError}
              </p>
            )}

            {/* Liste des dossiers */}
            {folders.length > 0 && (
              <ul className="mt-3 space-y-1">
                {folders.map((f) => (
                  <FolderItem key={f.path} folder={f} active={ingestingPath === f.path} />
                ))}
              </ul>
            )}

            {folders.length === 0 && !ingestingPath && (
              <p className="mt-4 px-1 text-xs text-text-muted leading-relaxed">
                Aucun dossier indexé.<br />
                Ajoutez vos PDF et Markdown.
              </p>
            )}
          </section>
        </div>

        {/* Statut modèle — pied de sidebar */}
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
              <p className="text-[11px] text-text-muted leading-none mb-0.5">
                Ollama
              </p>
              <p className="text-xs font-medium text-text-secondary truncate">
                {modelStatus.loading
                  ? "Connexion…"
                  : modelStatus.connected
                  ? modelStatus.model
                  : "Non connecté"}
              </p>
            </div>
          </div>

          {/* Badge privacy */}
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

function FolderItem({ folder, active }: { folder: IndexedFolder; active: boolean }) {
  return (
    <li
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-md
        ${active ? "bg-surface-3" : "hover:bg-surface-2"}
        transition-colors cursor-default group
      `}
    >
      <IconFolder className="shrink-0 text-accent/70" />
      <span className="text-xs text-text-secondary truncate flex-1" title={folder.path}>
        {folder.name}
      </span>
      <IconLock size={11} className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons
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

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="7" y1="2" x2="7" y2="12" />
      <line x1="2" y1="7" x2="12" y2="7" />
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

function IconSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="animate-spin"
    >
      <circle cx="7" cy="7" r="5.5" strokeOpacity="0.2" />
      <path d="M7 1.5A5.5 5.5 0 0112.5 7" strokeLinecap="round" />
    </svg>
  );
}
