import { useState, useCallback, useEffect, useRef } from "react";
import { selectFolder, isTauri } from "../api/backend";

interface DropZoneProps {
  onFolderSelected: (path: string) => void;
  disabled?: boolean;
}

export default function DropZone({ onFolderSelected, disabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0); // évite les faux dragLeave sur les enfants

  // Tauri : écoute les événements de drop natifs (donne les chemins absolus)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string[]>("tauri://file-drop", (event) => {
        setIsDragOver(false);
        dragCounterRef.current = 0;
        const paths = event.payload;
        if (paths.length > 0) onFolderSelected(paths[0]);
      }).then((fn) => { unlisten = fn; });

      // Feedback visuel drag-hover via événements Tauri
      listen("tauri://file-drop-hover", () => setIsDragOver(true));
      listen("tauri://file-drop-cancelled", () => {
        setIsDragOver(false);
        dragCounterRef.current = 0;
      });
    });

    return () => { unlisten?.(); };
  }, [onFolderSelected]);

  // Navigateur / Vite dev : événements DOM standard
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // nécessaire pour autoriser le drop
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    // En navigateur sans Tauri, on n'a pas les chemins absolus —
    // on informe l'utilisateur d'utiliser le bouton à la place.
    if (!isTauri()) return;
    // En Tauri, le drop est géré via l'événement natif ci-dessus.
  }, []);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    const path = await selectFolder();
    if (path) onFolderSelected(path);
  }, [disabled, onFolderSelected]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      disabled={disabled}
      className={`
        relative w-full rounded-xl border-2 border-dashed px-3 py-5
        flex flex-col items-center gap-2 cursor-pointer
        transition-all duration-200 group
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${disabled
          ? "border-border opacity-50 cursor-not-allowed"
          : isDragOver
          ? "border-accent bg-accent/10 shadow-glow scale-[1.01]"
          : "border-border hover:border-accent/60 hover:bg-accent/5"
        }
      `}
    >
      {/* Icône upload */}
      <div
        className={`
          w-9 h-9 rounded-lg flex items-center justify-center
          transition-all duration-200
          ${isDragOver
            ? "bg-accent/20 text-accent scale-110"
            : "bg-surface-3 text-text-muted group-hover:text-accent group-hover:bg-accent/10 group-hover:scale-105"
          }
        `}
      >
        {isDragOver ? <IconFolderOpen /> : <IconUpload />}
      </div>

      {/* Texte */}
      <div className="text-center">
        <p
          className={`text-xs font-medium transition-colors duration-150 ${
            isDragOver ? "text-accent" : "text-text-secondary group-hover:text-text-primary"
          }`}
        >
          {isDragOver ? "Relâchez pour indexer" : "Glisser un dossier"}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5">
          ou cliquer pour choisir
        </p>
      </div>

      {/* Badge formats */}
      <div className="flex gap-1">
        {["PDF", "MD"].map((ext) => (
          <span
            key={ext}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-muted border border-border"
          >
            {ext}
          </span>
        ))}
      </div>

      {/* Halo de drag actif */}
      {isDragOver && (
        <span className="absolute inset-0 rounded-xl border-2 border-accent animate-ping opacity-20 pointer-events-none" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
      <polyline points="6,6 9,3 12,6" />
      <line x1="9" y1="3" x2="9" y2="11" />
    </svg>
  );
}

function IconFolderOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5A1.5 1.5 0 013.5 4H7l2 2h5.5A1.5 1.5 0 0116 7.5V8" />
      <path d="M2 8h14l-1.5 6H3.5L2 8z" />
    </svg>
  );
}
