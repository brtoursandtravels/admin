/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  apiRequest,
  privateMediaUrl,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import { DeleteButton, DeleteRecordButton } from "../components/DeleteButton";
import type { MediaAsset, PublicationStatus, Taxonomy } from "../types";
import {
  ActionLink,
  BackLink,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorPanel,
  FieldError,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  getErrorMessage,
  useToast,
  useUnsavedChanges,
} from "../ui";

const taxonomySchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase words separated by hyphens.",
    ),
  name: z.string().min(2).max(160),
  description: z.string().max(5000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  sortOrder: z.string().regex(/^\d+$/, "Use a whole number."),
  isDemo: z.boolean(),
  coverMediaId: z.string().max(30),
});
type TaxonomyForm = z.infer<typeof taxonomySchema>;
const blankTaxonomy: TaxonomyForm = {
  slug: "",
  name: "",
  description: "",
  status: "DRAFT",
  sortOrder: "0",
  isDemo: false,
  coverMediaId: "",
};

function TaxonomyPage({
  resource,
  title,
  singular,
}: {
  resource: "destinations" | "categories";
  title: string;
  singular: string;
}) {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const [editing, setEditing] = useState<Taxonomy | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const form = useForm<TaxonomyForm>({
    resolver: zodResolver(taxonomySchema),
    defaultValues: blankTaxonomy,
  });
  useUnsavedChanges(form.formState.isDirty);
  const query = useQuery({
    queryKey: [resource],
    queryFn: () => apiRequest<DataResponse<Taxonomy[]>>(`/admin/${resource}`),
  });
  const media = useQuery({
    queryKey: ["media-library", "destination-covers"],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>(
        "/admin/media?pageSize=100&visibility=PUBLIC",
      ),
    enabled: resource === "destinations",
  });
  const save = useMutation({
    mutationFn: (values: TaxonomyForm) =>
      apiRequest<DataResponse<Taxonomy>>(
        editing ? `/admin/${resource}/${editing.id}` : `/admin/${resource}`,
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: {
            ...values,
            description: values.description || null,
            coverMediaId:
              resource === "destinations" ? values.coverMediaId || null : null,
            sortOrder: Number(values.sortOrder),
            publishedAt: null,
          },
        },
      ),
    onSuccess: async () => {
      notify(`${singular} ${editing ? "updated" : "created"}.`);
      setEditing(null);
      form.reset(blankTaxonomy);
      await queryClient.invalidateQueries({ queryKey: [resource] });
      navigate(`/${resource}`);
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/${resource}/${id}`, {
        method: "DELETE",
        csrfToken,
      }),
    onSuccess: async () => {
      notify(`${singular} archived.`);
      await queryClient.invalidateQueries({ queryKey: [resource] });
    },
  });
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        form.reset(blankTaxonomy);
        return;
      }
      const record = query.data?.data.find((item) => item.id === id);
      if (!record) return;
      setEditing(record);
      form.reset({
        slug: record.slug,
        name: record.name,
        description: record.description ?? "",
        status: record.status,
        sortOrder: String(record.sortOrder),
        isDemo: record.isDemo,
        coverMediaId: record.coverMediaId ?? "",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, form, id, query.data]);
  const visibleItems = (query.data?.data ?? []).filter((item) => {
    const matchesQuery =
      !listQuery ||
      `${item.name} ${item.slug}`.toLowerCase().includes(listQuery.toLowerCase());
    return matchesQuery && (!statusFilter || item.status === statusFilter);
  });
  return (
    <>
      <PageHeader
        eyebrow="Catalogue taxonomy"
        title={editorOpen ? (editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`) : title}
        description={`Manage labels, URL slugs, publication state and display order for ${title.toLowerCase()}.`}
        actions={
          editorOpen ? (
            <BackLink to={`/${resource}`} />
          ) : (
            <ActionLink to={`/${resource}/new`}>New {singular.toLowerCase()}</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-3xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
        <div className="grid gap-3 rounded-2xl border border-admin-border bg-admin-surface p-3 shadow-admin-card">
          <label className="grid gap-1.5 text-[0.79rem] font-bold text-admin-brand-deep">
            Search {title.toLowerCase()}
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 text-admin-ink-subtle" size={16} />
              <input className="admin-control pl-9! pr-9!" onChange={(event) => setListQuery(event.target.value)} placeholder="Name or URL slug" value={listQuery} />
              {listQuery ? <button aria-label="Clear search" className="absolute right-2 inline-flex size-7 items-center justify-center rounded-lg border-0 bg-transparent text-admin-ink-subtle hover:bg-admin-surface-muted" onClick={() => setListQuery("")} type="button"><X size={15} /></button> : null}
            </span>
          </label>
          <div className="flex gap-2 overflow-x-auto border-t border-admin-border-soft pt-3">
            {[{ label: "All", value: "" }, { label: "Published", value: "PUBLISHED" }, { label: "Drafts", value: "DRAFT" }, { label: "Archived", value: "ARCHIVED" }].map((filter) => {
              const count = (query.data?.data ?? []).filter((item) => !filter.value || item.status === filter.value).length;
              return <button className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[0.72rem] font-black transition ${statusFilter === filter.value ? "border-admin-brand bg-admin-brand text-white" : "border-admin-border bg-white text-admin-ink-muted hover:bg-admin-brand-soft"}`} key={filter.value} onClick={() => setStatusFilter(filter.value)} type="button">{filter.label} ({count})</button>;
            })}
          </div>
        </div>
        ) : null}
        {!editorOpen ? (
        <Card className="overflow-hidden p-0!">
          {query.isPending ? (
            <LoadingPanel />
          ) : query.isError ? (
            <ErrorPanel
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              description={listQuery || statusFilter ? "Clear or change the filters to see more records." : `Create the first ${singular.toLowerCase()} as a draft.`}
              action={!listQuery && !statusFilter ? <ActionLink to={`/${resource}/new`}>Create {singular.toLowerCase()}</ActionLink> : undefined}
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.name}</span>
                        <small>
                          /{item.slug}
                          {item.isDemo ? " · Demo" : ""}
                        </small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>{item.sortOrder}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => navigate(`/${resource}/${item.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              confirmText={`Archive ${singular.toLowerCase()}`}
                              dialogDescription={`This ${singular.toLowerCase()} will no longer be available for new public content.`}
                              dialogTitle={`Archive ${singular.toLowerCase()}?`}
                              detailText={`${item.name} · Associated tour packages remain protected but may need an update.`}
                              onConfirm={() => archive.mutateAsync(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                          <DeleteRecordButton resource={singular.toLowerCase()} name={item.name}
                            description={`Permanently delete this ${singular.toLowerCase()} and remove its links from packages? The packages will be kept.`}
                            endpoint={`/admin/${resource}/${item.id}/permanent`}
                            invalidateKeys={[resource, "admin-packages", "admin-package", "gallery-albums"]} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        ) : null}
        {editorOpen ? id && query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label={`Loading ${singular.toLowerCase()}…`} />
        ) : (
        <Card>
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{editing ? "Editing record" : "New record"}</p>
          <h2>{editing ? editing.name : `Create ${singular.toLowerCase()}`}</h2>
          {save.isError ? (
            <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
              {getErrorMessage(save.error)}
            </div>
          ) : null}
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            noValidate
          >
            <label>
              Name
              <input {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </label>
            <label>
              URL slug
              <input {...form.register("slug")} />
              <FieldError message={form.formState.errors.slug?.message} />
            </label>
            <label>
              Description
              <textarea {...form.register("description")} />
            </label>
            {resource === "destinations" ? (
              <div className="grid gap-3 rounded-[0.7rem] border border-admin-border bg-admin-surface-muted p-4">
                <label>
                  Place cover image
                  <select
                    disabled={media.isPending}
                    {...form.register("coverMediaId")}
                  >
                    <option value="">No cover image</option>
                    {media.data?.data
                      .filter((asset) => asset.mimeType.startsWith("image/"))
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.altText}
                        </option>
                      ))}
                  </select>
                  <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                    This image appears on the homepage and Destinations page.
                  </span>
                </label>
                {form.watch("coverMediaId") ? (
                  <img
                    className="aspect-video w-full max-w-xl rounded-[0.65rem] border border-admin-border object-cover"
                    src={privateMediaUrl(form.watch("coverMediaId"))}
                    alt="Selected destination cover preview"
                  />
                ) : null}
                <Link
                  className="inline-flex min-h-[2.6rem] w-fit items-center justify-center rounded-[0.6rem] border border-admin-border bg-admin-surface px-4 py-2.5 text-sm font-bold no-underline transition hover:bg-admin-brand-soft"
                  to="/media/new"
                >
                  Upload a new place image
                </Link>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Status
                <select {...form.register("status")}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
              <label>
                Display order
                <input inputMode="numeric" {...form.register("sortOrder")} />
              </label>
            </div>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Development
              demo content
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`/${resource}`)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        ) : null}
      </div>
    </>
  );
}
export function DestinationsPage() {
  return (
    <TaxonomyPage
      resource="destinations"
      title="Destinations"
      singular="Destination"
    />
  );
}
export function CategoriesPage() {
  return (
    <TaxonomyPage
      resource="categories"
      title="Categories"
      singular="Category"
    />
  );
}

const mediaMetadataSchema = z.object({
  altText: z.string().min(2).max(300),
  caption: z.string().max(500),
  sourceNotes: z.string().max(5000),
  licenseNotes: z.string().max(5000),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});
type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
export function MediaLibraryPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const uploadOpen = location.pathname.endsWith("/new");
  const editOpen = Boolean(id);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibility, setVisibility] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFields, setUploadFields] = useState<MediaMetadata>({
    altText: "",
    caption: "",
    sourceNotes: "",
    licenseNotes: "",
    visibility: "PRIVATE",
  });
  const form = useForm<MediaMetadata>({
    resolver: zodResolver(mediaMetadataSchema),
    defaultValues: uploadFields,
  });
  const query = useQuery({
    queryKey: ["media-library", page, pageSize, visibility],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>(
        `/admin/media?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(visibility ? { visibility } : {}) })}`,
      ),
  });
  const assetQuery = useQuery({
    queryKey: ["media-asset", id],
    queryFn: () => apiRequest<DataResponse<MediaAsset>>(`/admin/media/${id}`),
    enabled: editOpen,
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error("Choose an image or PDF to upload.");
      const body = new FormData();
      body.append("file", uploadFile);
      Object.entries(uploadFields).forEach(([key, value]) =>
        body.append(key, value),
      );
      return apiRequest<DataResponse<MediaAsset>>("/admin/media", {
        method: "POST",
        csrfToken,
        body,
      });
    },
    onSuccess: async () => {
      notify("Asset validated and stored safely.");
      setUploadFile(null);
      setUploadFields({
        altText: "",
        caption: "",
        sourceNotes: "",
        licenseNotes: "",
        visibility: "PRIVATE",
      });
      await queryClient.invalidateQueries({ queryKey: ["media-library"] });
      navigate("/media");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const update = useMutation({
    mutationFn: (values: MediaMetadata) =>
      apiRequest<DataResponse<MediaAsset>>(`/admin/media/${editing!.id}`, {
        method: "PATCH",
        csrfToken,
        body: {
          ...values,
          caption: values.caption || null,
          sourceNotes: values.sourceNotes || null,
          licenseNotes: values.licenseNotes || null,
        },
      }),
    onSuccess: async () => {
      notify("Media metadata updated.");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["media-library"] });
      navigate("/media");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  useEffect(() => {
    const asset = assetQuery.data?.data;
    if (!asset) return;
    const frame = requestAnimationFrame(() => {
      setEditing(asset);
      form.reset({
        altText: asset.altText,
        caption: asset.caption ?? "",
        sourceNotes: asset.sourceNotes ?? "",
        licenseNotes: asset.licenseNotes ?? "",
        visibility: asset.visibility,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [assetQuery.data, form]);
  const visibleAssets = (query.data?.data ?? []).filter((asset) =>
    !mediaQuery ||
    `${asset.altText} ${asset.originalName} ${asset.caption ?? ""}`
      .toLowerCase()
      .includes(mediaQuery.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Assets"
        title={uploadOpen ? "Upload media" : editOpen ? "Edit media details" : "Media library"}
        description="Raster images are signature-checked, decoded, metadata-stripped and re-encoded. PDF brochures are signature-checked and served as downloads; SVG and active content are rejected."
        actions={
          uploadOpen || editOpen ? (
            <BackLink to="/media" />
          ) : (
            <ActionLink to="/media/new">Upload media</ActionLink>
          )
        }
      />
      {uploadOpen ? (
      <Card className="mb-4 [&>button]:mt-4">
        <h2>Upload image or brochure</h2>
        <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
          <label>
            Image or PDF file
            <input
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              type="file"
              onChange={(event) =>
                setUploadFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <label>
            Visibility
            <select
              value={uploadFields.visibility}
              onChange={(event) =>
                setUploadFields((value) => ({
                  ...value,
                  visibility: event.target.value as MediaMetadata["visibility"],
                }))
              }
            >
              <option>PRIVATE</option>
              <option>PUBLIC</option>
            </select>
          </label>
          <label>
            Alt text
            <input
              value={uploadFields.altText}
              onChange={(event) =>
                setUploadFields((value) => ({
                  ...value,
                  altText: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Caption
            <input
              value={uploadFields.caption}
              onChange={(event) =>
                setUploadFields((value) => ({
                  ...value,
                  caption: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source notes
            <input
              value={uploadFields.sourceNotes}
              onChange={(event) =>
                setUploadFields((value) => ({
                  ...value,
                  sourceNotes: event.target.value,
                }))
              }
            />
          </label>
          <label>
            License / rights notes
            <input
              value={uploadFields.licenseNotes}
              onChange={(event) =>
                setUploadFields((value) => ({
                  ...value,
                  licenseNotes: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <Button
          disabled={
            upload.isPending ||
            !uploadFile ||
            uploadFields.altText.trim().length < 2
          }
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? "Processing…" : "Upload safely"}
        </Button>
      </Card>
      ) : null}
      {!uploadOpen && !editOpen ? (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.8rem] border border-admin-border bg-admin-surface p-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_input]:min-w-48 [&_select]:min-w-48">
        <label className="flex-1">
          Search this page
          <span className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 text-admin-ink-subtle" size={16} />
            <input className="pl-9! pr-9!" onChange={(event) => setMediaQuery(event.target.value)} placeholder="Alt text, caption or filename" value={mediaQuery} />
            {mediaQuery ? <button aria-label="Clear search" className="absolute right-2 inline-flex size-7 items-center justify-center rounded-lg border-0 bg-transparent text-admin-ink-subtle hover:bg-admin-surface-muted" onClick={() => setMediaQuery("")} type="button"><X size={15} /></button> : null}
          </span>
        </label>
        <label>
          Visibility
          <select
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All assets</option>
            <option>PUBLIC</option>
            <option>PRIVATE</option>
          </select>
        </label>
      </div>
      {query.isPending ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : visibleAssets.length === 0 ? (
        <Card>
          <EmptyState
            title="No media assets"
            description={mediaQuery ? "Clear the search to see more assets on this page." : "Upload a licensed image or brochure with a meaningful accessible label."}
            action={!mediaQuery ? <ActionLink to="/media/new">Upload media</ActionLink> : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2 max-[680px]:grid-cols-1">
            {visibleAssets.map((asset) => (
              <article className="overflow-hidden rounded-[0.8rem] border border-admin-border bg-admin-surface shadow-admin-card [&>img]:aspect-[4/3] [&>img]:w-full [&>img]:bg-admin-surface-muted [&>img]:object-cover [&>div]:p-4 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-sans [&_h3]:text-[0.9rem] [&_h3]:font-bold [&_p]:text-[0.68rem] [&_p]:text-admin-ink-muted" key={asset.id}>
                {asset.mimeType.startsWith("image/") ? (
                  <img
                    src={privateMediaUrl(asset.id)}
                    alt={asset.altText}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-admin-surface-muted p-0! text-2xl font-black tracking-[0.12em] text-admin-brand" aria-hidden="true">
                    PDF
                  </div>
                )}
                <div>
                  <StatusBadge value={asset.visibility} />
                  <h3>{asset.altText}</h3>
                  <p>
                    {asset.originalName} · {asset.mimeType}
                    {asset.width && asset.height
                      ? ` · ${asset.width}×${asset.height}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/media/${asset.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <DeleteRecordButton resource="media file" name={asset.altText || asset.originalName}
                      description="Permanently delete this file? Files still used by packages or other content must be unlinked first. This cannot be undone."
                      endpoint={`/admin/media/${asset.id}`} invalidateKeys={["media-library", "media-asset"]}
                      onDeleted={() => { if (query.data?.data.length === 1 && page > 1) setPage(page - 1); }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination meta={query.data.meta} onPage={setPage} onPageSize={(next) => { setPageSize(next); setPage(1); }} />
        </>
      )}
      </>
      ) : null}
      {editOpen ? (
        assetQuery.isError ? (
          <ErrorPanel error={assetQuery.error} retry={() => void assetQuery.refetch()} />
        ) : assetQuery.isPending || !editing ? (
          <LoadingPanel label="Loading media details…" />
        ) : (
        <div className="max-w-4xl">
          <section
            className="w-full rounded-2xl border border-admin-border bg-admin-surface p-[clamp(1.25rem,4vw,2rem)] shadow-admin-card"
          >
            <h2 id="media-edit-title">Edit media details</h2>
            <form
              className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
              onSubmit={form.handleSubmit((values) => update.mutate(values))}
            >
              <label>
                Alt text
                <input {...form.register("altText")} />
                <FieldError message={form.formState.errors.altText?.message} />
              </label>
              <label>
                Caption
                <textarea {...form.register("caption")} />
              </label>
              <label>
                Source notes
                <textarea {...form.register("sourceNotes")} />
              </label>
              <label>
                License / rights notes
                <textarea {...form.register("licenseNotes")} />
              </label>
              <label>
                Visibility
                <select {...form.register("visibility")}>
                  <option>PRIVATE</option>
                  <option>PUBLIC</option>
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button disabled={update.isPending} type="submit">
                  Save details
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/media")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </section>
        </div>
        )
      ) : null}
    </>
  );
}

type GalleryAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  destinationId: string | null;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
  images: Array<{
    mediaAssetId: string;
    sortOrder: number;
    mediaAsset: MediaAsset;
  }>;
};
const albumSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(2).max(200),
  description: z.string().max(10_000),
  destinationId: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string(),
  isDemo: z.boolean(),
  mediaIds: z.array(z.string()),
});
type AlbumForm = z.infer<typeof albumSchema>;
const blankAlbum: AlbumForm = {
  slug: "",
  title: "",
  description: "",
  destinationId: "",
  status: "DRAFT",
  publishedAt: "",
  isDemo: false,
  mediaIds: [],
};
export function GalleryAlbumsPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const [editing, setEditing] = useState<GalleryAlbum | null>(null);
  const [mediaChoice, setMediaChoice] = useState("");
  const form = useForm<AlbumForm>({
    resolver: zodResolver(albumSchema),
    defaultValues: blankAlbum,
  });
  useUnsavedChanges(form.formState.isDirty);
  const albums = useQuery({
    queryKey: ["gallery-albums"],
    queryFn: () =>
      apiRequest<DataResponse<GalleryAlbum[]>>("/admin/gallery/albums"),
  });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: () => apiRequest<DataResponse<Taxonomy[]>>("/admin/destinations"),
  });
  const media = useQuery({
    queryKey: ["media-library", "album"],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>("/admin/media?pageSize=100"),
    enabled: editorOpen,
  });
  const save = useMutation({
    mutationFn: (values: AlbumForm) =>
      apiRequest<DataResponse<GalleryAlbum>>(
        editing
          ? `/admin/gallery/albums/${editing.id}`
          : "/admin/gallery/albums",
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: {
            ...values,
            description: values.description || null,
            destinationId: values.destinationId || null,
            publishedAt: values.publishedAt
              ? new Date(values.publishedAt).toISOString()
              : null,
          },
        },
      ),
    onSuccess: async () => {
      notify(`Gallery album ${editing ? "updated" : "created"}.`);
      setEditing(null);
      form.reset(blankAlbum);
      await queryClient.invalidateQueries({ queryKey: ["gallery-albums"] });
      navigate("/gallery");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/gallery/albums/${id}`, {
        method: "DELETE",
        csrfToken,
      }),
    onSuccess: async () => {
      notify("Gallery album archived.");
      await queryClient.invalidateQueries({ queryKey: ["gallery-albums"] });
    },
  });
  const selected = form.watch("mediaIds");
  const assetById = useMemo(
    () => new Map(media.data?.data.map((item) => [item.id, item]) ?? []),
    [media.data],
  );
  const move = (index: number, direction: -1 | 1) => {
    const next = [...selected];
    const target = index + direction;
    [next[index], next[target]] = [next[target]!, next[index]!];
    form.setValue("mediaIds", next, { shouldDirty: true });
  };
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        form.reset(blankAlbum);
        return;
      }
      const record = albums.data?.data.find((item) => item.id === id);
      if (!record) return;
      setEditing(record);
      form.reset({
        slug: record.slug,
        title: record.title,
        description: record.description ?? "",
        destinationId: record.destinationId ?? "",
        status: record.status,
        publishedAt: record.publishedAt?.slice(0, 16) ?? "",
        isDemo: record.isDemo,
        mediaIds: [...record.images]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((image) => image.mediaAssetId),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [albums.data, editorOpen, form, id]);
  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title={editorOpen ? (editing ? "Edit gallery album" : "New gallery album") : "Gallery albums"}
        description="Create public or private albums, assign destinations, and control image order."
        actions={
          editorOpen ? (
            <BackLink to="/gallery" />
          ) : (
            <ActionLink to="/gallery/new">New album</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
        <Card className="overflow-hidden p-0!">
          {albums.isPending ? (
            <LoadingPanel />
          ) : albums.isError ? (
            <ErrorPanel
              error={albums.error}
              retry={() => void albums.refetch()}
            />
          ) : albums.data.data.length === 0 ? (
            <EmptyState
              title="No albums"
              description="Create a draft album, then attach media."
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Album</th>
                    <th>Status</th>
                    <th>Images</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {albums.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.title}</span>
                        <small>/{item.slug}</small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>{item.images.length}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => navigate(`/gallery/${item.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              confirmText="Archive album"
                              dialogDescription="The album will be hidden from the public gallery and retained as an archived record."
                              dialogTitle="Archive gallery album?"
                              detailText={item.title}
                              onConfirm={() => archive.mutateAsync(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                          <DeleteRecordButton resource="gallery album" name={item.title}
                            description="Permanently delete this album? Its image files will stay in the media library."
                            endpoint={`/admin/gallery/albums/${item.id}/permanent`} invalidateKeys={["gallery-albums", "media-library"]} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        ) : null}
        {editorOpen ? id && albums.isError ? (
          <ErrorPanel error={albums.error} retry={() => void albums.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label="Loading gallery album…" />
        ) : (
        <Card>
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{editing ? "Editing album" : "New album"}</p>
          <h2>{editing?.title ?? "Create gallery album"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
          >
            <label>
              Title
              <input {...form.register("title")} />
            </label>
            <label>
              URL slug
              <input {...form.register("slug")} />
            </label>
            <label>
              Description
              <textarea {...form.register("description")} />
            </label>
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Destination
                <select {...form.register("destinationId")}>
                  <option value="">No destination</option>
                  {destinations.data?.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select {...form.register("status")}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
            </div>
            <label>
              Publish date
              <input type="datetime-local" {...form.register("publishedAt")} />
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Development
              demo content
            </label>
            <div>
              <span className="grid gap-1.5 text-[0.79rem] font-bold text-admin-brand-deep [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">Images and order</span>
              <div className="flex items-center gap-2 max-[680px]:w-full max-[680px]:flex-col max-[680px]:items-stretch [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_select]:min-w-60">
                <select
                  value={mediaChoice}
                  onChange={(event) => setMediaChoice(event.target.value)}
                >
                  <option value="">Choose media…</option>
                  {media.data?.data
                    .filter(
                      (asset) =>
                        asset.mimeType.startsWith("image/") &&
                        !selected.includes(asset.id),
                    )
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.altText}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  disabled={!mediaChoice}
                  onClick={() => {
                    form.setValue("mediaIds", [...selected, mediaChoice], {
                      shouldDirty: true,
                    });
                    setMediaChoice("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="mt-3 grid gap-2 [&>div]:grid [&>div]:grid-cols-[3rem_1fr_auto] [&>div]:items-center [&>div]:gap-2.5 [&>div]:rounded-[0.6rem] [&>div]:border [&>div]:border-admin-border [&>div]:p-1.5 [&_img]:aspect-square [&_img]:h-12 [&_img]:w-12 [&_img]:rounded-[0.35rem] [&_img]:object-cover [&_span]:text-[0.74rem] [&_span]:font-bold">
                {selected.map((id, index) => (
                  <div key={id}>
                    <img
                      src={privateMediaUrl(id)}
                      alt={assetById.get(id)?.altText ?? "Album media"}
                    />
                    <span>{assetById.get(id)?.altText ?? id}</span>
                    <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={index === selected.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </Button>
                      <DeleteButton
                        resource="album image"
                        name={assetById.get(id)?.altText || `Image ${index + 1}`}
                        label="Remove"
                        description="Remove this image from the album? The file will stay in the media library. Save the album to apply this change."
                        onDelete={() =>
                          form.setValue(
                            "mediaIds",
                            selected.filter((value) => value !== id),
                            { shouldDirty: true },
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button disabled={save.isPending} type="submit">
                Save album
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/gallery")}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        ) : null}
      </div>
    </>
  );
}
