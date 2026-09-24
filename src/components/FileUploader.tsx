import { AdminSelect } from "./AdminSelect";
import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FileText, FolderOpen, Star } from "lucide-react";
import { apiRequest, privateMediaUrl, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import type { MediaAsset } from "../types";
import { Button, ErrorPanel, LoadingPanel, getErrorMessage, useConfirm, useToast } from "../ui";
import { EditorDialog } from "./EditorDialog";
import { FileDropzone } from "./FileDropzone";

export interface CommonFileUploaderProps {
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
  value: MediaAsset[] | MediaAsset | null;
  onChange: (assets: MediaAsset[]) => void;
  allowCoverSelection?: boolean;
  coverAssetId?: string;
  onSetCover?: (assetId: string) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const fileSize = (bytes: string) => `${(Number(bytes) / 1024 / 1024).toFixed(2)} MB`;

/** Both adding and replacing files use the same device/library controls. */
function FileSourcePicker({ pdf, multiple = false, disabled, onUpload, onLibrary }: {
  pdf: boolean;
  multiple?: boolean;
  disabled: boolean;
  onUpload: (files: File[]) => void;
  onLibrary: () => void;
}) {
  return <div className="@container min-w-0">
    <div className="grid gap-3 @min-[40rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" onDragOver={event => event.preventDefault()} onDrop={event => event.preventDefault()}>
      <FileDropzone kind={pdf ? "pdf" : "image"} multiple={multiple} disabled={disabled} onFiles={onUpload} />
      <div aria-hidden="true" className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-wider text-admin-ink-subtle">
        <span className="h-px flex-1 bg-admin-border @min-[40rem]:hidden" /><span>or</span><span className="h-px flex-1 bg-admin-border @min-[40rem]:hidden" />
      </div>
      <section aria-label="Choose from media library" className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-admin-border bg-admin-surface p-5 text-center sm:p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-admin-surface-muted text-admin-brand"><FolderOpen aria-hidden="true" size={23} /></span>
        <h4 className="m-0 text-base font-bold text-admin-brand-deep">Choose from library</h4>
        <p className="m-0 max-w-sm text-sm leading-6 text-admin-ink-muted">Reuse {pdf ? "a PDF" : multiple ? "photos" : "a photo"} already uploaded to your media library.</p>
        <p className="m-0 text-xs leading-5 text-admin-ink-subtle">Browse or search your saved {pdf ? "brochures" : "photos"}.</p>
        <Button className="mt-auto w-full max-w-xs" type="button" variant="secondary" disabled={disabled} onClick={onLibrary}>Select from library</Button>
      </section>
    </div>
  </div>;
}

export function FileUploader({ multiple = false, maxFiles = 10, accept = "image/*", value, onChange, allowCoverSelection = false, coverAssetId, onSetCover, label = "Images", helperText, disabled = false, onBusyChange }: CommonFileUploaderProps) {
  const assets = Array.isArray(value) ? value : value ? [value] : [];
  const limit = multiple ? maxFiles : 1;
  const pdf = accept === "application/pdf";
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const client = useQueryClient();
  const [library, setLibrary] = useState<{ replaceId?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState("");
  const [fileError, setFileError] = useState("");
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<MediaAsset["visibility"]>("PUBLIC");
  const busy = useRef(false);
  const selected = useRef(assets);
  const change = useRef(onChange);
  useEffect(() => { selected.current = assets; change.current = onChange; });
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const listing = useQuery({ queryKey: ["media-library", "picker", pdf, query, page], enabled: Boolean(library),
    queryFn: () => apiRequest<PageResponse<MediaAsset>>(`/admin/media?${new URLSearchParams({ kind: pdf ? "pdf" : "image", q: query, page: String(page), pageSize: "24" })}`) });
  const locked = disabled || Boolean(progress);
  function cache(asset: MediaAsset) { client.setQueryData(["media-asset", asset.id], { data: asset }); }
  function commit(next: MediaAsset[]) { selected.current = next; change.current(next); }
  function start(message: string) { busy.current = true; setFileError(""); setProgress(message); onBusyChange?.(true); }
  function finish() { busy.current = false; setProgress(""); onBusyChange?.(false); }
  function attach(asset: MediaAsset, replaceId?: string) {
    cache(asset);
    commit(replaceId ? selected.current.map(item => item.id === replaceId ? asset : item) : [...selected.current, asset]);
    if (replaceId && replaceId === coverAssetId) onSetCover?.(asset.id);
  }
  async function upload(files: File[], replaceId?: string) {
    if (disabled || busy.current || !files.length) return;
    const remaining = replaceId ? 1 : limit - selected.current.length;
    if (files.length > remaining) { setFileError(replaceId ? "Choose one replacement file." : `Choose up to ${remaining} more ${pdf ? "PDF" : "image"} file(s).`); return; }
    if (files.some(file => !(pdf ? file.type === "application/pdf" : imageTypes.includes(file.type)) || file.size > 4_000_000)) {
      setFileError(`Choose ${pdf ? "PDF files" : "JPEG, PNG, WebP or AVIF images"} under 4 MB each.`); return;
    }
    if (replaceId && altText.trim().length < 2) { setFileError("Enter at least two characters of alternative text."); return; }
    start("Preparing upload…");
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        const body = new FormData();
        body.append("file", file);
        const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
        body.append("altText", replaceId ? altText.trim() : (name.length >= 2 ? name : pdf ? "Travel brochure" : "Travel image").slice(0, 300));
        body.append("visibility", replaceId ? visibility : "PUBLIC");
        if (replaceId) {
          body.append("caption", caption.trim());
          if (editing?.sourceNotes) body.append("sourceNotes", editing.sourceNotes);
          if (editing?.licenseNotes) body.append("licenseNotes", editing.licenseNotes);
        }
        const { data } = await apiRequest<DataResponse<MediaAsset>>("/admin/media", { method: "POST", csrfToken, body });
        attach(data, replaceId);
      }
      setEditing(null);
      notify(replaceId ? "File replaced. Save the entry to apply the change." : "Upload complete. Save the entry to attach your files.");
    } catch (error) { setFileError(getErrorMessage(error)); }
    finally { finish(); void client.invalidateQueries({ queryKey: ["media-library"] }); }
  }
  async function remove(asset: MediaAsset) {
    await confirm({ title: `Remove ${pdf ? "brochure" : "image"} from ${label.toLowerCase()}?`, message: "This removes the file from this entry. The original asset remains in your media library. Save the entry to apply the change.", detailText: asset.originalName, confirmText: "Remove file", tone: "warning", action: () => commit(selected.current.filter(item => item.id !== asset.id)) });
  }
  function choose(asset: MediaAsset) {
    if (disabled || busy.current || !library || selected.current.some(item => item.id === asset.id) || (!library.replaceId && selected.current.length >= limit)) return;
    attach(asset, library.replaceId);
    setFileError("");
    if (library.replaceId) {
      setEditing(null);
      notify("File replaced. Save the entry to apply the change.");
    }
    if (library.replaceId || !multiple || selected.current.length >= limit) setLibrary(null);
  }
  async function saveMetadata() {
    if (!editing || disabled || busy.current) return;
    if (altText.trim().length < 2) { setFileError("Enter at least two characters of alternative text."); return; }
    start("Saving file details…");
    try {
      const { data } = await apiRequest<DataResponse<MediaAsset>>(`/admin/media/${editing.id}`, { method: "PATCH", csrfToken, body: { altText: altText.trim(), caption: caption || null, visibility, sourceNotes: editing.sourceNotes, licenseNotes: editing.licenseNotes } });
      cache(data); commit(selected.current.map(asset => asset.id === data.id ? data : asset));
      setEditing(null); notify("File details saved.");
      void client.invalidateQueries({ queryKey: ["media-library"] });
    } catch (error) { setFileError(getErrorMessage(error)); } finally { finish(); }
  }
  return (
    <section className="@container grid min-w-0 gap-4" aria-label={label}>
      <div><h3 className="m-0 text-base font-bold text-admin-brand-deep">{label}</h3>{helperText ? <p className="mt-1 text-sm text-admin-ink-muted">{helperText}</p> : null}</div>
      {assets.length < limit ? <FileSourcePicker pdf={pdf} multiple={multiple} disabled={locked} onUpload={files => void upload(files)} onLibrary={() => setLibrary({})} /> : null}
      <p className="m-0 text-xs text-admin-ink-muted">{assets.length}/{limit} selected</p>
      {!editing && progress ? <p role="status" className="rounded-lg bg-admin-brand-soft p-3 text-sm">{progress}</p> : null}
      {!editing && fileError ? <p role="alert" className="rounded-lg border border-admin-negative p-3 text-sm text-admin-negative">{fileError}</p> : null}
      <div className={`grid gap-3 ${multiple ? "@min-[30rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[64rem]:grid-cols-4" : "max-w-xl"}`}>
        {assets.map((asset, index) => <article key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-admin-border bg-admin-surface">
          <a href={privateMediaUrl(asset.id)} target="_blank" rel="noreferrer" aria-label={`Preview ${asset.originalName}`} className="grid aspect-video place-items-center bg-admin-surface-muted">
            {asset.mimeType.startsWith("image/") ? <img src={privateMediaUrl(asset.id)} alt={asset.altText} loading="lazy" className="h-full max-h-48 w-full object-contain" /> : <FileText size={44} className="text-admin-brand" />}
          </a>
          <div className="grid gap-2 p-3">
            <strong className="truncate text-sm" title={asset.originalName}>{asset.originalName}</strong>
            <span className="text-xs text-admin-ink-muted">{fileSize(asset.sizeBytes)}{asset.width ? ` · ${asset.width} × ${asset.height}` : ""} · {asset.visibility}</span>
            {asset.visibility === "PRIVATE" ? <span className="text-xs text-admin-negative">Private file: hidden on the public site.</span> : null}
            {allowCoverSelection ? <Button type="button" variant="ghost" disabled={locked} onClick={() => onSetCover?.(asset.id)} aria-pressed={coverAssetId === asset.id}><Star size={14} fill={coverAssetId === asset.id ? "currentColor" : "none"} />{coverAssetId === asset.id ? "Cover image" : "Set as cover"}</Button> : null}
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" disabled={locked} onClick={() => { setFileError(""); setEditing(asset); setAltText(asset.altText); setCaption(asset.caption ?? ""); setVisibility(asset.visibility); }}>Edit</Button>
              <Button type="button" variant="ghost" disabled={locked} onClick={() => void remove(asset)}>Remove</Button>
              {multiple ? <><Button type="button" variant="ghost" aria-label={`Move ${asset.originalName} up`} disabled={locked || index === 0} onClick={() => { const next = [...assets]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; commit(next); }}><ArrowUp size={14} /></Button><Button type="button" variant="ghost" aria-label={`Move ${asset.originalName} down`} disabled={locked || index === assets.length - 1} onClick={() => { const next = [...assets]; [next[index + 1], next[index]] = [next[index]!, next[index + 1]!]; commit(next); }}><ArrowDown size={14} /></Button></> : null}
            </div>
          </div>
        </article>)}
      </div>
      {library ? <EditorDialog title={`Select ${pdf ? "brochure" : "images"} from library`} onClose={() => setLibrary(null)}>
        {library.replaceId ? <p className="text-sm text-admin-ink-muted">Choose one file to replace the current {pdf ? "brochure" : "photo"}. The selected file keeps its saved details and visibility.</p> : null}
        <label className="grid gap-2 text-sm">Search media<input className="admin-control" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {listing.isPending ? <LoadingPanel /> : listing.isError ? <ErrorPanel error={listing.error} retry={() => void listing.refetch()} /> : <>
          <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{listing.data.data.map(asset => <button type="button" key={asset.id} disabled={locked || assets.some(item => item.id === asset.id) || (!library.replaceId && assets.length >= limit)} onClick={() => choose(asset)} className="overflow-hidden rounded-xl border border-admin-border p-2 text-left disabled:opacity-40">
            {asset.mimeType.startsWith("image/") ? <img className="aspect-video w-full object-contain" src={privateMediaUrl(asset.id)} alt={asset.altText} loading="lazy" /> : <FileText className="mx-auto my-5" />}
            <span className="mt-2 block truncate text-xs font-bold">{asset.originalName}</span><span className="text-xs">{asset.visibility}</span>
          </button>)}</div>
          {!listing.data.data.length ? <p>No matching files.</p> : null}
          <div className="flex items-center justify-between gap-3"><Button type="button" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous files</Button><span className="text-xs">Page {page} of {Math.max(1, Math.ceil(listing.data.meta.total / 24))}</span><Button type="button" variant="secondary" disabled={page * 24 >= listing.data.meta.total} onClick={() => setPage(page + 1)}>Next files</Button></div>
        </>}
      </EditorDialog> : null}
      {editing ? <EditorDialog title="Edit file" onClose={() => { setFileError(""); setEditing(null); }} busy={locked}>
        <div className="grid gap-4">
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-admin-surface-muted p-3">
            {editing.mimeType.startsWith("image/") ? <img className="size-16 shrink-0 rounded-lg object-cover" src={privateMediaUrl(editing.id)} alt={editing.altText} /> : <FileText aria-hidden="true" className="size-10 shrink-0 text-admin-brand" />}
            <div className="min-w-0"><p className="m-0 text-xs text-admin-ink-muted">Current file</p><strong className="block truncate text-sm" title={editing.originalName}>{editing.originalName}</strong></div>
          </div>
          <section aria-label="Replace file" className="grid min-w-0 gap-3">
            <div><h3 className="m-0 text-base font-bold text-admin-brand-deep">Replace file</h3><p className="mb-0 mt-1 text-sm text-admin-ink-muted">Choose one replacement below, then save the entry to apply it.</p></div>
            <FileSourcePicker pdf={pdf} disabled={locked} onUpload={files => void upload(files, editing.id)} onLibrary={() => setLibrary({ replaceId: editing.id })} />
          </section>
          {progress ? <p role="status" className="m-0 rounded-lg bg-admin-brand-soft p-3 text-sm">{progress}</p> : null}
          {fileError ? <p role="alert" className="m-0 rounded-lg border border-admin-negative p-3 text-sm text-admin-negative">{fileError}</p> : null}
          <fieldset disabled={locked} className="grid min-w-0 gap-3 border-0 border-t border-solid border-admin-border p-0 pt-4">
            <legend className="sr-only">File details</legend>
            <div><h3 className="m-0 text-base font-bold text-admin-brand-deep">File details</h3><p className="mb-0 mt-1 text-sm text-admin-ink-muted">Saving details updates this file wherever it is used. Uploading a replacement copies these details to the new file.</p></div>
            <label className="grid gap-1 text-sm">Alternative text<input className="admin-control" value={altText} maxLength={300} onChange={event => setAltText(event.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Caption<textarea className="admin-control" value={caption} maxLength={500} rows={2} onChange={event => setCaption(event.target.value)} /></label>
              <label className="grid content-start gap-1 text-sm">Visibility<AdminSelect aria-label="Visibility" className="admin-control" value={visibility} onValueChange={selectedValue => setVisibility(selectedValue as MediaAsset["visibility"])}><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></AdminSelect></label>
            </div>
            <Button type="button" disabled={locked} onClick={() => void saveMetadata()}>Save file details</Button>
          </fieldset>
        </div>
      </EditorDialog> : null}
    </section>
  );
}

/** Resolve selected IDs separately, including assets beyond the first library page. */
export function MediaPicker({ ids, onChange, ...props }: Omit<CommonFileUploaderProps, "value"> & { ids: string[] }) {
  const queries = useQueries({ queries: ids.map(id => ({ queryKey: ["media-asset", id], queryFn: () => apiRequest<DataResponse<MediaAsset>>(`/admin/media/${id}`), staleTime: 60_000 })) });
  const error = queries.find(query => query.isError);
  if (error) return <ErrorPanel error={error.error} retry={() => void error.refetch()} />;
  if (queries.some(query => query.isPending)) return <LoadingPanel label={`Loading ${props.label ?? "selected files"}…`} />;
  return <FileUploader {...props} value={queries.flatMap(query => query.data ? [query.data.data] : [])} onChange={onChange} />;
}
