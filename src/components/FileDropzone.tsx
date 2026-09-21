import { useRef, useState } from "react";
import { FileText, ImagePlus, Upload } from "lucide-react";
import { Button } from "../ui";

/** Shared device picker for library uploads, package photos and file replacement. */
export function FileDropzone({ kind = "image", multiple = false, disabled = false, onFiles }: {
  kind?: "image" | "pdf" | "any";
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const noun = kind === "pdf" ? "PDF" : kind === "any" ? "file" : multiple ? "photos" : "photo";
  const Icon = kind === "pdf" ? FileText : kind === "any" ? Upload : ImagePlus;
  const accept = [kind !== "pdf" ? "image/jpeg,image/png,image/webp,image/avif" : "", kind !== "image" ? "application/pdf" : ""].filter(Boolean).join(",");
  return <section
    aria-label={`Upload new ${noun}`}
    aria-disabled={disabled}
    onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) onFiles(Array.from(event.dataTransfer.files)); }}
    className={`flex min-w-0 flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:p-6 ${dragging && !disabled ? "border-admin-brand bg-admin-brand-soft" : "border-admin-border bg-admin-surface-muted"}`}
  >
    <span className="grid size-11 place-items-center rounded-xl bg-admin-brand-soft text-admin-brand"><Icon aria-hidden="true" size={23} /></span>
    <h4 className="m-0 text-base font-bold text-admin-brand-deep">Upload new {noun}</h4>
    <p className="m-0 max-w-sm text-sm leading-6 text-admin-ink-muted">Choose {multiple ? noun : `a ${noun}`} from your device or drag {multiple ? "them" : "it"} into this box.</p>
    <p className="m-0 text-xs leading-5 text-admin-ink-subtle">{kind === "pdf" ? "PDF" : `JPG, PNG, WebP or AVIF${kind === "any" ? ", or a PDF brochure" : ""}`} · Up to 4 MB {multiple ? "each" : "per file"}.</p>
    <input ref={input} className="hidden" type="file" aria-label={`Upload ${kind === "image" ? "photos" : noun} from your device`} accept={accept} multiple={multiple} disabled={disabled} onChange={event => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <Button className="mt-auto w-full max-w-xs" type="button" disabled={disabled} onClick={() => input.current?.click()}>Choose {noun}</Button>
  </section>;
}
