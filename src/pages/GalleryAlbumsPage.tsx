import { FieldLabel } from "../components/FieldLabel";
import { FormSelect } from "../components/FormSelect";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, CalendarClock, Images, MapPin, Plus, Search, X } from "lucide-react";
import { z } from "zod";
import { apiRequest, privateMediaUrl, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { DeleteRecordButton } from "../components/DeleteButton";
import { FileUploader } from "../components/FileUploader";
import type { MediaAsset, PublicationStatus, Taxonomy } from "../types";
import { ActionLink, BackLink, Button, Card, ConfirmButton, EmptyState, ErrorPanel, FieldError, LoadingPanel, PageHeader, StatusBadge, formatDate, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

type GalleryAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  destinationId: string | null;
  destination?: Taxonomy | null;
  status: PublicationStatus;
  publishedAt: string | null;
  updatedAt?: string;
  isDemo: boolean;
  images: Array<{ mediaAssetId: string; sortOrder: number; mediaAsset: MediaAsset }>;
};
const albumSchema = z.object({
  title: z.string().trim().min(2, "Enter an album title of at least 2 characters.").max(200),
  description: z.string().trim().max(10_000),
  destinationId: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().refine(value => !value || !Number.isNaN(new Date(value).getTime()), "Choose a valid publish date and time."),
  mediaIds: z.array(z.string()).max(200, "An album can contain up to 200 photos."),
});
type AlbumForm = z.infer<typeof albumSchema>;

function useCurrentTime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useAlbums() {
  return useQuery({ queryKey: ["gallery-albums"], queryFn: ({ signal }) => apiRequest<DataResponse<GalleryAlbum[]>>("/admin/gallery/albums", { signal }) });
}
function orderedPhotos(album: GalleryAlbum) {
  return [...album.images].sort((a, b) => a.sortOrder - b.sortOrder).map(image => image.mediaAsset);
}
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function albumSlug(title: string, suffix: string) {
  const base = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 160).replace(/^-|-$/g, "") || "album";
  // A stable suffix lets albums share a title without requiring admins to manage URLs.
  return `${base}-${suffix}`;
}
function AlbumCover({ asset, title }: { asset?: MediaAsset; title: string }) {
  const [failed, setFailed] = useState(false);
  return asset && !failed
    ? <img src={privateMediaUrl(asset.id)} alt={asset.altText} loading="lazy" onError={() => setFailed(true)} className="aspect-[16/10] w-full object-cover" />
    : <div aria-label={`${title}: no cover photo`} className="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-admin-surface-muted text-admin-ink-subtle"><Images size={38} strokeWidth={1.4} aria-hidden="true" /><span className="text-sm">{failed ? "Preview unavailable" : "Add photos to this album"}</span></div>;
}

function AlbumList() {
  const now = useCurrentTime();
  const albums = useAlbums();
  const client = useQueryClient();
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PublicationStatus | "">("");
  const rows = albums.data?.data ?? [];
  const visible = rows.filter(album => (!status || album.status === status) && `${album.title} ${album.description ?? ""} ${album.destination?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const archive = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/admin/gallery/albums/${id}`, { method: "DELETE", csrfToken }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["gallery-albums"] }); notify("Album archived."); },
  });
  const filtered = Boolean(search || status);
  function clearFilters() { setSearch(""); setStatus(""); }
  return <>
    <PageHeader eyebrow="Gallery" title="Gallery albums" description="Organise your travel photos into albums and choose what visitors see in the gallery." actions={<ActionLink to="/gallery/new"><Plus size={17} aria-hidden="true" />New album</ActionLink>} />
    <section aria-label="Find albums" className="mb-5 rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-admin-card">
      <label className="grid gap-2 text-sm font-bold">Search albums<span className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-admin-ink-subtle" /><input aria-label="Search albums" className="admin-control pl-10! pr-10!" value={search} onChange={event => setSearch(event.target.value)} placeholder="Album title, description or destination" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-2 right-2 rounded-lg p-2 hover:bg-admin-surface-muted"><X size={16} /></button>}</span></label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-admin-border-soft pt-4">
        <div role="group" aria-label="Album status" className="flex flex-wrap gap-1.5">{[{ value: "", label: "All albums" }, { value: "PUBLISHED", label: "Published" }, { value: "DRAFT", label: "Drafts" }, { value: "ARCHIVED", label: "Archived" }].map(option => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value as typeof status)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${status === option.value ? "bg-admin-brand text-white" : "bg-admin-surface-muted text-admin-ink-muted hover:bg-admin-brand-soft"}`}>{option.label}<span className="text-xs opacity-75">{option.value ? rows.filter(album => album.status === option.value).length : rows.length}</span></button>)}</div>
        <div className="flex items-center gap-3 text-sm text-admin-ink-muted"><span aria-live="polite">{visible.length} {visible.length === 1 ? "album" : "albums"}{filtered ? " found" : " in your gallery"}</span>{filtered && <button type="button" onClick={clearFilters} className="font-bold text-admin-brand underline underline-offset-4">Clear filters</button>}</div>
      </div>
    </section>
    {albums.isPending ? <LoadingPanel label="Loading albums…" /> : albums.isError ? <ErrorPanel error={albums.error} retry={() => void albums.refetch()} /> : !visible.length ? <Card><EmptyState title={filtered ? "No matching albums" : "Create your first gallery album"} description={filtered ? "Try another search or clear the status filter." : "Give your album a title, add your favourite travel photos and publish when you are ready."} action={filtered ? <Button type="button" variant="secondary" onClick={clearFilters}>Clear filters</Button> : <ActionLink to="/gallery/new">New album</ActionLink>} /></Card> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {visible.map(album => {
        const photos = orderedPhotos(album);
        const publicPhotos = photos.filter(asset => asset.visibility === "PUBLIC");
        const cover = publicPhotos[0] ?? photos[0];
        const scheduled = album.status === "PUBLISHED" && Boolean(album.publishedAt && new Date(album.publishedAt).getTime() > now);
        return <article key={album.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-admin-card">
          <div className="relative"><AlbumCover key={cover?.id ?? "empty"} asset={cover} title={album.title} /><span className="absolute top-3 left-3 rounded-full bg-white/95"><StatusBadge value={scheduled ? "SCHEDULED" : album.status} /></span><span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-admin-brand-deep/85 px-2.5 py-1.5 text-xs font-bold text-white"><Images size={14} aria-hidden="true" />{photos.length} {photos.length === 1 ? "photo" : "photos"}</span></div>
          <div className="flex flex-1 flex-col p-4"><h2 className="m-0 line-clamp-2 text-lg leading-6 font-bold text-admin-brand-deep">{album.title}</h2>{album.destination && <p className="my-2 inline-flex items-center gap-1.5 text-xs font-bold text-admin-brand"><MapPin size={14} aria-hidden="true" />{album.destination.name}</p>}{album.description && <p className="mt-1 mb-3 line-clamp-2 text-sm leading-6 text-admin-ink-muted">{album.description}</p>}<p className="mt-auto mb-3 pt-2 text-xs text-admin-ink-muted">{scheduled ? `Scheduled for ${formatDate(album.publishedAt)}` : `${publicPhotos.length} public ${publicPhotos.length === 1 ? "photo" : "photos"}${photos.length !== publicPhotos.length ? ` · ${photos.length - publicPhotos.length} private` : ""}`}</p>
            <div className="flex flex-wrap gap-2 border-t border-admin-border-soft pt-3 [&>a]:px-3 [&>button]:px-3"><ActionLink to={`/gallery/${album.id}/edit`} variant="secondary">Edit album</ActionLink>{album.status !== "ARCHIVED" && <ConfirmButton type="button" tone="warning" disabled={archive.isPending} dialogTitle="Archive gallery album?" dialogDescription="This hides the album from the public gallery. You can publish it again from the album editor." detailText={album.title} confirmText="Archive album" onConfirm={() => archive.mutateAsync(album.id)}><Archive size={14} aria-hidden="true" />Archive</ConfirmButton>}<DeleteRecordButton resource="gallery album" name={album.title} description="Permanently delete this album? Its image files will stay in the media library." endpoint={`/admin/gallery/albums/${album.id}/permanent`} invalidateKeys={["gallery-albums", "media-library"]} /></div>
          </div>
        </article>;
      })}
    </div>}
  </>;
}

function AlbumEditor({ album }: { album?: GalleryAlbum }) {
  const now = useCurrentTime();
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<MediaAsset[]>(() => album ? orderedPhotos(album) : []);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slugSuffix] = useState(() => crypto.randomUUID().replaceAll("-", "").slice(0, 16));
  const form = useForm<AlbumForm>({ resolver: zodResolver(albumSchema), defaultValues: { title: album?.title ?? "", description: album?.description ?? "", destinationId: album?.destinationId ?? "", status: album?.status ?? "DRAFT", publishedAt: localDate(album?.publishedAt ?? null), mediaIds: photos.map(asset => asset.id) } });
  const title = useWatch({ control: form.control, name: "title" });
  const description = useWatch({ control: form.control, name: "description" });
  const status = useWatch({ control: form.control, name: "status" });
  const publishAt = useWatch({ control: form.control, name: "publishedAt" });
  const destinationId = useWatch({ control: form.control, name: "destinationId" });
  const destinations = useQuery({ queryKey: ["destinations"], queryFn: ({ signal }) => apiRequest<DataResponse<Taxonomy[]>>("/admin/destinations", { signal }) });
  const publicPhotos = photos.filter(asset => asset.visibility === "PUBLIC");
  const cover = publicPhotos[0];
  const save = useMutation({
    mutationFn: (values: AlbumForm) => apiRequest<DataResponse<GalleryAlbum>>(album ? `/admin/gallery/albums/${album.id}` : "/admin/gallery/albums", {
      method: album ? "PUT" : "POST", csrfToken,
      body: { ...values, slug: album?.slug ?? albumSlug(values.title, slugSuffix), description: values.description || null, destinationId: values.destinationId || null, isDemo: album?.isDemo ?? false, publishedAt: values.publishedAt === localDate(album?.publishedAt ?? null) ? album?.publishedAt ?? null : values.publishedAt ? new Date(values.publishedAt).toISOString() : null },
    }),
    onSuccess: async (_response, values) => {
      flushSync(() => { setSaved(true); form.reset(values); });
      await client.invalidateQueries({ queryKey: ["gallery-albums"] });
      notify(`Gallery album ${album ? "updated" : "created"}.`);
      navigate("/gallery");
    },
    onError: error => notify(getErrorMessage(error), "error"),
  });
  const busy = save.isPending || uploading;
  useUnsavedChanges(!saved && (form.formState.isDirty || busy));
  function changePhotos(next: MediaAsset[]) {
    setPhotos(next);
    form.setValue("mediaIds", next.map(asset => asset.id), { shouldDirty: true, shouldValidate: true });
    form.clearErrors("mediaIds");
  }
  function setCover(id: string) {
    const selected = photos.find(asset => asset.id === id);
    if (!selected || selected.visibility !== "PUBLIC") { notify("Make this photo public in its file details before using it as the album cover.", "error"); return; }
    changePhotos([selected, ...photos.filter(asset => asset.id !== id)]);
  }
  function submit(values: AlbumForm) {
    if (busy) return;
    if (values.status === "PUBLISHED" && !publicPhotos.length) {
      form.setError("mediaIds", { message: "Add at least one public photo before publishing. You can save a draft while you prepare the album." });
      document.getElementById("album-photos")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    save.mutate(values);
  }
  const destinationName = destinations.data?.data.find(item => item.id === destinationId)?.name ?? (album?.destinationId === destinationId ? album.destination?.name : undefined);
  return <>
    <PageHeader eyebrow="Gallery" title={album ? "Edit gallery album" : "New gallery album"} description="Add your travel photos, arrange their order and choose when your album appears in the gallery." actions={<BackLink to="/gallery" label="Back to albums" />} />
    <form noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-5">
          <Card><h2>Album details</h2><p className="mt-2 mb-5 text-sm text-admin-ink-muted">Give these photos a name and a little context.</p><fieldset disabled={save.isPending} className="admin-form min-w-0 border-0 p-0">
            <label><FieldLabel required>Album title</FieldLabel><input aria-required="true" aria-label="Album title" maxLength={200} placeholder="For example, A journey through Rajasthan" aria-invalid={Boolean(form.formState.errors.title)} {...form.register("title")} /><FieldError message={form.formState.errors.title?.message} /></label>
            <label>Description <span className="text-xs font-normal text-admin-ink-muted">Optional · Introduce the places or moments in this album.</span><textarea aria-label="Description" rows={3} maxLength={10_000} placeholder="Tell visitors about this journey…" {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></label>
            <label>Destination <span className="text-xs font-normal text-admin-ink-muted">Optional · Group this album with a destination.</span><FormSelect aria-label="Destination" disabled={destinations.isPending || destinations.isError || save.isPending} control={form.control} name={"destinationId"}><option value="">No destination</option>{destinationId && !destinations.data?.data.some(item => item.id === destinationId) && <option value={destinationId}>{album?.destination?.name ?? "Current destination"}</option>}{destinations.data?.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormSelect></label>
            {destinations.isError && <ErrorPanel error={destinations.error} retry={() => void destinations.refetch()} />}
          </fieldset></Card>
          <div id="album-photos" className="scroll-mt-24"><Card><FileUploader required={status === "PUBLISHED"} multiple maxFiles={200} value={photos} onChange={changePhotos} allowCoverSelection coverAssetId={cover?.id} onSetCover={setCover} label="Album photos" helperText="Upload new photos or choose from your library. The first public photo is the cover; use Set as cover or the arrows to arrange your photos." disabled={save.isPending} onBusyChange={setUploading} /><div className="mt-3"><FieldError message={form.formState.errors.mediaIds?.message} /></div></Card></div>
        </div>
        <aside className="grid min-w-0 gap-5">
          <Card><h2>Publishing</h2><fieldset disabled={save.isPending} className="admin-form mt-4 min-w-0 border-0 p-0"><label><FieldLabel required>Status</FieldLabel><FormSelect aria-required="true" aria-label="Status" control={form.control} name={"status"}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></FormSelect></label><p className="m-0 text-sm leading-6 text-admin-ink-muted">{status === "DRAFT" ? "Keep this album hidden while you prepare it." : status === "ARCHIVED" ? "This album stays saved and is hidden from the public gallery." : "Public photos will appear in the gallery after you save."}</p>{status === "PUBLISHED" && <label>Publish date & time <span className="text-xs font-normal text-admin-ink-muted">Optional · Leave empty to publish now. Times use your device’s timezone.</span><input aria-label="Publish date & time" type="datetime-local" {...form.register("publishedAt")} /><FieldError message={form.formState.errors.publishedAt?.message} /></label>}</fieldset><div className="mt-4 rounded-xl bg-admin-surface-muted p-3 text-sm"><p className="m-0 font-bold">{photos.length} {photos.length === 1 ? "photo" : "photos"} selected</p><p className="mt-1 mb-0 text-admin-ink-muted">{publicPhotos.length} public · {photos.length - publicPhotos.length} private</p>{photos.length !== publicPhotos.length && <p className="mt-2 mb-0 text-xs leading-5 text-admin-ink-muted">Private photos remain in the album for admins and are hidden from visitors.</p>}</div>{status === "PUBLISHED" && publishAt && !Number.isNaN(new Date(publishAt).getTime()) && new Date(publishAt).getTime() > now && <p className="mt-3 mb-0 flex items-start gap-2 text-xs leading-5 text-admin-brand"><CalendarClock size={16} className="shrink-0" aria-hidden="true" />Scheduled for {formatDate(new Date(publishAt).toISOString())}.</p>}</Card>
          <section aria-label="Album cover preview" className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-admin-card"><div className="border-b border-admin-border-soft px-4 py-3 text-xs font-bold uppercase tracking-wide text-admin-ink-muted">Album cover preview</div><AlbumCover key={cover?.id ?? "empty"} asset={cover} title={title || "Your album"} /><div className="p-4"><h3 className="m-0 text-lg font-bold [overflow-wrap:anywhere]">{title || "Your album title"}</h3>{destinationName && <p className="mt-2 mb-0 text-xs font-bold text-admin-brand">{destinationName}</p>}{description && <p className="mt-2 mb-0 line-clamp-3 text-sm leading-6 text-admin-ink-muted [overflow-wrap:anywhere]">{description}</p>}</div></section>
        </aside>
      </div>
      {save.isError && <div className="mt-5"><ErrorPanel error={save.error} /></div>}
      <div className="sticky bottom-4 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-border bg-admin-surface/95 p-4 shadow-admin-elevated backdrop-blur-xl"><p className="m-0 text-sm text-admin-ink-muted" role="status">{uploading ? "Uploading photos. Please wait before saving." : save.isPending ? "Saving your album…" : form.formState.isDirty ? "You have unsaved changes." : album ? "All changes saved." : "Add a title and photos to get started."}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => navigate("/gallery")}>Cancel</Button><Button type="submit" disabled={busy}>{save.isPending ? "Saving…" : "Save album"}</Button></div></div>
    </form>
  </>;
}

function ExistingAlbum({ id }: { id: string }) {
  const albums = useAlbums();
  if (albums.isPending) return <LoadingPanel label="Loading gallery album…" />;
  if (albums.isError) return <><BackLink to="/gallery" /><ErrorPanel error={albums.error} retry={() => void albums.refetch()} /></>;
  const album = albums.data.data.find(item => item.id === id);
  if (!album) return <Card><EmptyState title="Album not found" description="This album may have been deleted. Return to the gallery to choose another album." action={<BackLink to="/gallery" label="Back to albums" />} /></Card>;
  return <AlbumEditor key={id} album={album} />;
}

export default function GalleryAlbumsPage() {
  const { id } = useParams();
  const location = useLocation();
  if (id) return <ExistingAlbum id={id} />;
  if (location.pathname.endsWith("/new")) return <AlbumEditor />;
  return <AlbumList />;
}
