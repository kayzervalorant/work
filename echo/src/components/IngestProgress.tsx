import type { IngestJob, IngestStatus } from "../types";

interface IngestProgressProps {
  job: IngestJob;
}

// Étapes visuelles dans l'ordre
const STEPS: { status: IngestStatus; label: string }[] = [
  { status: "reading",    label: "Lecture des fichiers" },
  { status: "embedding",  label: "Génération des vecteurs" },
  { status: "finalizing", label: "Finalisation" },
  { status: "done",       label: "Indexation terminée" },
];

function stepIndex(status: IngestStatus): number {
  return STEPS.findIndex((s) => s.status === status);
}

export default function IngestProgress({ job }: IngestProgressProps) {
  const isError = job.status === "error";
  const isDone  = job.status === "done";
  const currentIdx = stepIndex(job.status);

  const progressPct =
    job.files_total > 0
      ? Math.round((job.files_done / job.files_total) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-3 space-y-3 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
          {isError ? "Erreur d'indexation" : isDone ? "Indexation terminée" : "Indexation en cours…"}
        </span>
        {isDone && (
          <span className="text-[10px] text-status-online font-medium">
            {job.chunks_total} chunks
          </span>
        )}
      </div>

      {/* Erreur */}
      {isError && (
        <p className="text-xs text-status-offline leading-relaxed bg-status-offline/10 border border-status-offline/20 rounded-lg px-2.5 py-2">
          {job.error || "Erreur inconnue."}
        </p>
      )}

      {/* Steps */}
      {!isError && (
        <ol className="space-y-1.5">
          {STEPS.map((step, idx) => {
            const done    = isDone ? true : idx < currentIdx;
            const active  = !isDone && idx === currentIdx;
            const pending = !isDone && idx > currentIdx;

            return (
              <li key={step.status} className="flex items-center gap-2">
                {/* Indicateur */}
                <span
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center shrink-0
                    transition-all duration-300
                    ${done    ? "bg-status-online"  : ""}
                    ${active  ? "bg-accent animate-pulse-slow" : ""}
                    ${pending ? "bg-surface-3 border border-border" : ""}
                  `}
                >
                  {done && <IconCheck />}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-surface-base" />}
                </span>
                <span
                  className={`text-xs transition-colors duration-200 ${
                    done    ? "text-status-online" :
                    active  ? "text-text-primary font-medium" :
                              "text-text-muted"
                  }`}
                >
                  {step.label}
                  {active && job.current_file && (
                    <span className="ml-1.5 text-text-muted font-normal truncate max-w-[110px] inline-block align-bottom">
                      — {job.current_file}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Barre de progression */}
      {!isError && !isDone && job.files_total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>{job.files_done} / {job.files_total} fichiers</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Résumé final */}
      {isDone && (
        <div className="flex items-center gap-1.5 text-[11px] text-status-online">
          <IconCheck />
          <span>
            {job.files_done} fichier{job.files_done > 1 ? "s" : ""} indexé{job.files_done > 1 ? "s" : ""} —{" "}
            {job.chunks_total} vecteurs créés
          </span>
        </div>
      )}
    </div>
  );
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1.5,5 4,7.5 8.5,2.5" />
    </svg>
  );
}
