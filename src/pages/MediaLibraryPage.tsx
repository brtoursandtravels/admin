import { AdminSelect } from "../components/AdminSelect";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Download, Expand, FileText, Globe, Image, LockKeyhole, Search, Upload, X } from "lucide-react";
import { apiRequest, downloadProtected, privateMediaUrl, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import { DeleteRecordButton } from "../components/DeleteButton";
import { EditorDialog } from "../components/EditorDialog";
import { FileDropzone } from "../components/FileDropzone";
import type { MediaAsset } from "../types";
import { ActionLink, BackLink, Button, Card, EmptyState, ErrorPanel, FieldError, LoadingPanel, PageHeader, Pagination, StatusBadge, formatDate, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

const metadataSchema = z.object({
  altText: z.string().trim().min(2, "Add a description of at least 2 characters.").max(300),
  caption: z.string().trim().max(500),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});
type Metadata = z.infer<typeof metadataSchema>;
const emptyMetadata: Metadata = { altText: "", caption: "", visibility: "PRIVATE" };
const fileSize = (bytes: string | number) => Number(bytes) < 1_000_000 ? `${Math.max(1, Math.round(Number(bytes) / 1000))} KB` : `${(Number(bytes) / 1_000_000).toFixed(1)} MB`;

function AssetPreview({ asset, full = false }: { asset: MediaAsset; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  return asset.mimeType.startsWith("image/") && !failed
    ? <img src={privateMediaUrl(asset.id)} alt={asset.altText} loading="lazy" decoding="async" onError={() => setFailed(true)} className={full ? "max-h-[55vh] w-full object-contain" : "aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"} />
    : <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-admin-surface-muted text-admin-brand"><FileText size={42} strokeWidth={1.4} /><span className="text-sm font-bold">{failed ? "Preview unavailable" : "PDF brochure"}</span></div>;
}

function LocalPreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file.type.startsWith("image/")
    ? <img ref={ref} alt={`Preview of ${file.name}`} className="max-h-72 w-full object-contain" />
    : <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-admin-brand"><FileText size={44} /><span className="font-bold">PDF brochure selected</span></div>;
}

function MediaList() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibility, setVisibility] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const { notify } = useToast();
  useEffect(() => {
    const timer = setTimeout(() => { setQueryText(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["media-library", "list", page, pageSize, visibility, kind, queryText],
    queryFn: ({ signal }) => apiRequest<PageResponse<MediaAsset>>(`/admin/media?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(visibility ? { visibility } : {}), ...(kind ? { kind } : {}), ...(queryText ? { q: queryText } : {}) })}`, { signal }),
  });
  const download = useMutation({ mutationFn: (asset: MediaAsset) => downloadProtected(`/admin/media/${asset.id}/file`, asset.originalName), onError: error => notify(getErrorMessage(error), "error") });
  const filtered = Boolean(queryText || kind || visibility);
  function clearFilters() { setSearch(""); setQueryText(""); setKind(""); setVisibility(""); setPage(1); }
  return <>
    <PageHeader eyebrow="Assets" title="Media library" description="Your photos and brochures, ready to use across packages, galleries and blog posts." actions={<ActionLink to="/media/new"><Upload size={16} aria-hidden="true" />Upload media</ActionLink>} />
    <section aria-label="Find media" className="mb-5 rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-admin-card">
      <div className="flex flex-wrap gap-4">
        <label className="grid min-w-0 flex-1 basis-64 gap-2 text-sm font-bold">Search library
          <span className="relative"><Search size={17} className="pointer-events-none absolute top-3.5 left-3 text-admin-ink-subtle" aria-hidden="true" /><input className="admin-control pl-10! pr-10!" placeholder="Search all filenames and alt text" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" className="absolute top-2 right-2 rounded-lg p-2 hover:bg-admin-surface-muted" onClick={() => setSearch("")}><X size={16} /></button>}</span>
        </label>
        <label className="grid min-w-44 gap-2 text-sm font-bold">Visibility<AdminSelect aria-label="Visibility" className="admin-control" value={visibility} onValueChange={selectedValue => { setVisibility(selectedValue); setPage(1); }}><option value="">All visibility</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></AdminSelect></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-admin-border-soft pt-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="File type">{[{ value: "", label: "All files", Icon: null }, { value: "image", label: "Photos", Icon: Image }, { value: "pdf", label: "PDF brochures", Icon: FileText }].map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${kind === value ? "bg-admin-brand text-white" : "bg-admin-surface-muted text-admin-ink-muted hover:bg-admin-brand-soft"}`}>{Icon && <Icon size={16} aria-hidden="true" />}{label}</button>)}</div>
        <p className="m-0 flex items-center gap-3 text-sm text-admin-ink-muted" aria-live="polite">{query.data ? `${query.data.meta.total} ${query.data.meta.total === 1 ? "file" : "files"}${filtered ? " found" : " in your library"}` : "Finding files…"}{filtered && <button type="button" className="font-bold text-admin-brand underline underline-offset-4" onClick={clearFilters}>Clear filters</button>}</p>
      </div>
    </section>
    {query.isPending ? <LoadingPanel label="Loading media…" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : query.data.data.length === 0 ? <Card><EmptyState title={filtered ? "No matching files" : "Your library is ready for its first file"} description={filtered ? "Try another filename or alt text, or clear the filters." : "Upload a photo or PDF brochure, then choose it from the library when editing your content."} action={filtered ? <Button type="button" variant="secondary" onClick={clearFilters}>Clear filters</Button> : <ActionLink to="/media/new">Upload media</ActionLink>} /></Card> : <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {query.data.data.map(asset => <article key={asset.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-admin-card">
          <button type="button" aria-label={`Preview ${asset.originalName}`} className="group relative block w-full overflow-hidden bg-admin-surface-muted text-left" onClick={() => setPreview(asset)}><AssetPreview asset={asset} /><span className="absolute top-3 left-3 rounded-full bg-white/95"><StatusBadge value={asset.visibility} /></span><span className="absolute right-3 bottom-3 rounded-lg bg-white/95 p-2 text-admin-brand shadow-sm"><Expand size={17} aria-hidden="true" /></span></button>
          <div className="flex flex-1 flex-col p-4"><h2 className="m-0 line-clamp-2 text-base leading-6 font-bold text-admin-brand-deep" title={asset.altText}>{asset.altText}</h2><p className="mt-1 mb-2 truncate text-xs text-admin-ink-muted" title={asset.originalName}>{asset.originalName}</p><p className="mt-auto mb-3 text-xs text-admin-ink-subtle">{asset.mimeType === "application/pdf" ? "PDF" : asset.mimeType.replace("image/", "").toUpperCase()} · {fileSize(asset.sizeBytes)}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}</p><div className="flex flex-wrap gap-2 border-t border-admin-border-soft pt-3"><ActionLink variant="secondary" to={`/media/${asset.id}/edit`}>Edit details</ActionLink><DeleteRecordButton resource="media file" name={asset.altText || asset.originalName} description="Permanently delete this file? Files still used by packages or other content must be unlinked first. This cannot be undone." endpoint={`/admin/media/${asset.id}`} invalidateKeys={["media-library", "media-asset"]} onDeleted={() => { if (query.data.data.length === 1 && page > 1) setPage(page - 1); }} /></div></div>
        </article>)}
      </div>
      <Pagination meta={query.data.meta} onPage={setPage} onPageSize={next => { setPageSize(next); setPage(1); }} />
    </>}
    {preview && <EditorDialog title="File preview" onClose={() => setPreview(null)}><div className="overflow-hidden rounded-xl bg-admin-surface-muted p-3"><AssetPreview key={preview.id} asset={preview} full /></div><div className="my-5 grid gap-2"><h3 className="m-0 text-lg font-bold [overflow-wrap:anywhere]">{preview.altText}</h3><p className="m-0 text-sm text-admin-ink-muted [overflow-wrap:anywhere]">{preview.originalName} · {fileSize(preview.sizeBytes)} · Added {formatDate(preview.createdAt)}</p>{preview.caption && <p className="m-0 text-sm">{preview.caption}</p>}</div><div className="flex flex-wrap gap-2"><ActionLink to={`/media/${preview.id}/edit`}>Edit details</ActionLink><Button type="button" variant="secondary" disabled={download.isPending} onClick={() => download.mutate(preview)}><Download size={16} />{download.isPending ? "Downloading…" : "Download file"}</Button></div></EditorDialog>}
  </>;
}

function MediaEditor({ asset }: { asset?: MediaAsset }) {
  const { csrfToken } = useAuth();
  const client = useQueryClient();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useForm<Metadata>({ resolver: zodResolver(metadataSchema), defaultValues: asset ? { altText: asset.altText, caption: asset.caption ?? "", visibility: asset.visibility } : emptyMetadata });
  const save = useMutation({
    mutationFn: (values: Metadata) => {
      if (asset) return apiRequest<DataResponse<MediaAsset>>(`/admin/media/${asset.id}`, { method: "PATCH", csrfToken, body: { ...values, caption: values.caption || null, sourceNotes: asset.sourceNotes, licenseNotes: asset.licenseNotes } });
      if (!file) throw new Error("Choose a photo or PDF brochure to upload.");
      const body = new FormData(); body.append("file", file);
      Object.entries(values).forEach(([key, value]) => body.append(key, value));
      return apiRequest<DataResponse<MediaAsset>>("/admin/media", { method: "POST", csrfToken, body });
    },
    onSuccess: async response => {
      client.setQueryData(["media-asset", response.data.id], response);
      flushSync(() => { setSaved(true); setFile(null); form.reset(); });
      await client.invalidateQueries({ queryKey: ["media-library"] });
      notify(asset ? "Media details saved." : "File added to your media library.");
      navigate("/media");
    },
    onError: error => notify(getErrorMessage(error), "error"),
  });
  useUnsavedChanges(!saved && (Boolean(file) || form.formState.isDirty || save.isPending));
  function chooseFiles(files: File[]) {
    if (!files.length || save.isPending) return;
    const selected = files[0]!;
    if (files.length !== 1) { setFileError("Choose one photo or PDF at a time."); return; }
    if (!["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"].includes(selected.type)) { setFileError("Choose a JPG, PNG, WebP, AVIF image or a PDF brochure."); return; }
    if (!selected.size || selected.size > 4_000_000) { setFileError("Choose a non-empty file up to 4 MB."); return; }
    setFileError(""); save.reset(); setFile(selected);
    if (!form.getValues("altText").trim()) {
      const name = selected.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 300);
      form.setValue("altText", name.length >= 2 ? name : selected.type === "application/pdf" ? "Travel brochure" : "Travel photo", { shouldDirty: true, shouldValidate: true });
    }
  }
  return <>
    <PageHeader eyebrow="Assets" title={asset ? "Edit media details" : "Upload media"} description={asset ? "Update this file’s details wherever it is used in your content." : "Add a photo or PDF brochure to your library, then use it in your content."} actions={<BackLink to="/media" label="Back to library" />} />
    <form noValidate onSubmit={form.handleSubmit(values => { if (!save.isPending) save.mutate(values); })}>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card><h2>{asset ? "File preview" : "1. Choose your file"}</h2><p className="mt-2 mb-5 text-sm leading-6 text-admin-ink-muted">{asset ? "This file is shared wherever you have selected it from the library." : "Upload one photo or brochure at a time. You can review it before saving."}</p>
          {asset ? <><div className="overflow-hidden rounded-xl bg-admin-surface-muted p-2"><AssetPreview asset={asset} full /></div><p className="mt-4 mb-1 text-sm font-bold [overflow-wrap:anywhere]">{asset.originalName}</p><p className="mb-3 text-xs text-admin-ink-muted">{fileSize(asset.sizeBytes)}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""} · Added {formatDate(asset.createdAt)}</p><StatusBadge value={asset.visibility} /></> : <>
            {file && <div className="mb-4 overflow-hidden rounded-xl border border-admin-border"><div className="bg-admin-surface-muted p-3"><LocalPreview key={`${file.name}-${file.lastModified}`} file={file} /></div><div className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="m-0 truncate text-sm font-bold" title={file.name}>{file.name}</p><p className="m-0 text-xs text-admin-ink-muted">{fileSize(file.size)} · Ready to upload</p></div><Button type="button" variant="ghost" aria-label="Remove selected file" disabled={save.isPending} onClick={() => { setFile(null); setFileError(""); save.reset(); }}><X size={17} /></Button></div></div>}
            <FileDropzone kind="any" disabled={save.isPending} onFiles={chooseFiles} />
            <div className="mt-3"><FieldError message={fileError} /></div>
          </>}
        </Card>
        <Card><h2>{asset ? "File details" : "2. Add file details"}</h2><p className="mt-2 mb-5 text-sm leading-6 text-admin-ink-muted">Give this file a helpful description so it is easy to find and accessible to visitors.</p>
          <fieldset disabled={save.isPending} className="admin-form min-w-0 border-0 p-0">
            <label>Alt text <span className="text-xs font-normal text-admin-ink-muted">Required · Briefly describe the photo or brochure.</span><input aria-label="Alt text" maxLength={300} aria-invalid={Boolean(form.formState.errors.altText)} placeholder="For example, sunset over Jaisalmer fort" {...form.register("altText")} /><FieldError message={form.formState.errors.altText?.message} /></label>
            <label>Caption <span className="text-xs font-normal text-admin-ink-muted">Optional · Extra context for this file.</span><textarea aria-label="Caption" rows={2} maxLength={500} placeholder="Add a short caption" {...form.register("caption")} /><FieldError message={form.formState.errors.caption?.message} /></label>
            <fieldset className="min-w-0 border-0 p-0"><legend className="mb-2 text-sm font-bold">Visibility</legend><div className="grid gap-2 sm:grid-cols-2">{[{ value: "PRIVATE", label: "Private", help: "For admin use only.", Icon: LockKeyhole }, { value: "PUBLIC", label: "Public", help: "Can appear on your website.", Icon: Globe }].map(({ value, label, help, Icon }) => <label key={value} className="relative flex! cursor-pointer items-start gap-3! rounded-xl border border-admin-border p-3 has-checked:border-admin-brand has-checked:bg-admin-brand-soft"><input className="mt-1 accent-admin-brand" type="radio" value={value} {...form.register("visibility")} /><span><span className="flex items-center gap-2"><Icon size={15} aria-hidden="true" />{label}</span><span className="mt-1 block text-xs leading-5 font-normal text-admin-ink-muted">{help}</span></span></label>)}</div><FieldError message={form.formState.errors.visibility?.message} /></fieldset>
          </fieldset>
          {save.isError && <div className="mt-4"><ErrorPanel error={save.error} /></div>}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-admin-border-soft pt-5"><Button type="submit" disabled={save.isPending || (!asset && !file)}>{!asset && <Upload size={16} aria-hidden="true" />}{save.isPending ? asset ? "Saving…" : "Uploading…" : asset ? "Save details" : "Upload to library"}</Button><Button type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate("/media")}>Cancel</Button><span className="text-xs text-admin-ink-muted" role="status">{save.isPending ? "Please keep this page open." : !asset && !file ? "Choose a file to continue." : ""}</span></div>
        </Card>
      </div>
    </form>
  </>;
}

function ExistingMedia({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["media-asset", id], queryFn: ({ signal }) => apiRequest<DataResponse<MediaAsset>>(`/admin/media/${id}`, { signal }) });
  if (query.isPending) return <LoadingPanel label="Loading media details…" />;
  if (query.isError) return <><BackLink to="/media" /><ErrorPanel error={query.error} retry={() => void query.refetch()} /></>;
  return <MediaEditor key={id} asset={query.data.data} />;
}

export default function MediaLibraryPage() {
  const { id } = useParams();
  const location = useLocation();
  if (id) return <ExistingMedia id={id} />;
  if (location.pathname.endsWith("/new")) return <MediaEditor />;
  return <MediaList />;
}
