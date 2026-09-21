import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function EditorDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[min(60rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-admin-border bg-admin-surface p-5 text-admin-ink shadow-xl backdrop:bg-black/50">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold">{title}</h2><button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-admin-surface-muted"><X size={20} /></button></div>
      {children}
    </dialog>, document.body,
  );
}
