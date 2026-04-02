/**
 * Toast.tsx — Système de notifications UI élégantes (top-right).
 *
 * Usage :
 *   <ToastContainer toasts={toasts} onDismiss={removeToast} />
 */

import { useEffect } from "react";
import type { Toast } from "../types";

const AUTO_DISMISS_MS = 5_000;

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const styles = {
    error:   { bar: "bg-status-offline",  icon: <IconError />,   border: "border-status-offline/30", bg: "bg-status-offline/10" },
    warning: { bar: "bg-status-loading",  icon: <IconWarning />, border: "border-status-loading/30", bg: "bg-status-loading/10" },
    success: { bar: "bg-status-online",   icon: <IconCheck />,   border: "border-status-online/30",  bg: "bg-status-online/10" },
    info:    { bar: "bg-accent",          icon: <IconInfo />,    border: "border-accent/30",          bg: "bg-accent/10" },
  }[toast.kind];

  return (
    <div
      className={`
        pointer-events-auto relative flex items-start gap-3
        w-80 max-w-full px-4 py-3 rounded-xl
        border ${styles.border} ${styles.bg}
        shadow-lg backdrop-blur-sm
        animate-slide-up
      `}
      role="alert"
    >
      {/* Barre colorée à gauche */}
      <div className={`absolute left-0 inset-y-0 w-1 rounded-l-xl ${styles.bar}`} />

      {/* Icône */}
      <div className="shrink-0 mt-0.5 pl-1">{styles.icon}</div>

      {/* Message */}
      <p className="flex-1 text-sm text-text-secondary leading-snug pr-1">
        {toast.message}
      </p>

      {/* Bouton fermer */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-text-muted hover:text-text-primary transition-colors mt-0.5"
        aria-label="Fermer"
      >
        <IconClose />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconError() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="6.5" />
      <line x1="7.5" y1="4.5" x2="7.5" y2="8" />
      <circle cx="7.5" cy="10.5" r="0.8" fill="#f87171" stroke="none" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 2L1 13h13L7.5 2z" />
      <line x1="7.5" y1="6" x2="7.5" y2="9.5" />
      <circle cx="7.5" cy="11.5" r="0.8" fill="#fbbf24" stroke="none" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="7.5" r="6.5" />
      <polyline points="4.5,7.5 6.5,9.5 10.5,5.5" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="6.5" />
      <line x1="7.5" y1="7" x2="7.5" y2="11" />
      <circle cx="7.5" cy="4.5" r="0.8" fill="#22d3ee" stroke="none" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="11" y2="11" />
      <line x1="11" y1="2" x2="2" y2="11" />
    </svg>
  );
}
