/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  apiRequest,
  privateMediaUrl,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import type { MediaAsset, PublicationStatus, Taxonomy } from "../types";
import {
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
});
type TaxonomyForm = z.infer<typeof taxonomySchema>;
const blankTaxonomy: TaxonomyForm = {
  slug: "",
  name: "",
  description: "",
  status: "DRAFT",
  sortOrder: "0",
  isDemo: false,
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
  const [editing, setEditing] = useState<Taxonomy | null>(null);
  const form = useForm<TaxonomyForm>({
    resolver: zodResolver(taxonomySchema),
    defaultValues: blankTaxonomy,
  });
  useUnsavedChanges(form.formState.isDirty);
  const query = useQuery({
    queryKey: [resource],
    queryFn: () => apiRequest<DataResponse<Taxonomy[]>>(`/admin/${resource}`),
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
  const beginEdit = (item: Taxonomy) => {
    setEditing(item);
    form.reset({
      slug: item.slug,
      name: item.name,
      description: item.description ?? "",
      status: item.status,
      sortOrder: String(item.sortOrder),
      isDemo: item.isDemo,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Catalogue taxonomy"
        title={title}
        description={`Manage labels, URL slugs, publication state and display order for ${title.toLowerCase()}.`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(blankTaxonomy);
            }}
          >
            New {singular.toLowerCase()}
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card className="overflow-hidden p-0!">
          {query.isPending ? (
            <LoadingPanel />
          ) : query.isError ? (
            <ErrorPanel
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data.data.length === 0 ? (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              description={`Create the first ${singular.toLowerCase()} as a draft.`}
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
                  {query.data.data.map((item) => (
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
                            onClick={() => beginEdit(item)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              question={`Archive ${item.name}? Existing package relations remain protected.`}
                              onClick={() => archive.mutate(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
                  onClick={() => {
                    setEditing(null);
                    form.reset(blankTaxonomy);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
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
  const [page, setPage] = useState(1);
  const [visibility, setVisibility] = useState("");
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
    queryKey: ["media-library", page, visibility],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>(
        `/admin/media?${new URLSearchParams({ page: String(page), pageSize: "20", ...(visibility ? { visibility } : {}) })}`,
      ),
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
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/media/${id}`, { method: "DELETE", csrfToken }),
    onSuccess: async () => {
      notify("Unreferenced media removed.");
      await queryClient.invalidateQueries({ queryKey: ["media-library"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const edit = (asset: MediaAsset) => {
    setEditing(asset);
    form.reset({
      altText: asset.altText,
      caption: asset.caption ?? "",
      sourceNotes: asset.sourceNotes ?? "",
      licenseNotes: asset.licenseNotes ?? "",
      visibility: asset.visibility,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Assets"
        title="Media library"
        description="Raster images are signature-checked, decoded, metadata-stripped and re-encoded. PDF brochures are signature-checked and served as downloads; SVG and active content are rejected."
      />
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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.8rem] border border-admin-border bg-admin-surface p-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_input]:min-w-48 [&_select]:min-w-48">
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
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No media assets"
            description="Upload a licensed image or brochure with a meaningful accessible label."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2 max-[680px]:grid-cols-1">
            {query.data.data.map((asset) => (
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
                    <Button variant="secondary" onClick={() => edit(asset)}>
                      Edit
                    </Button>
                    <ConfirmButton
                      question="Delete this media asset? In-use assets are protected by the API."
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(asset.id)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination meta={query.data.meta} onPage={setPage} />
        </>
      )}
      {editing ? (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-admin-overlay p-4" role="presentation">
          <section
            aria-labelledby="media-edit-title"
            aria-modal="true"
            className="max-h-[calc(100vh-2rem)] w-full max-w-[38rem] overflow-y-auto rounded-[0.9rem] bg-admin-surface p-[clamp(1.25rem,4vw,2rem)] shadow-admin-dialog"
            role="dialog"
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
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </section>
        </div>
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
  const beginEdit = (item: GalleryAlbum) => {
    setEditing(item);
    form.reset({
      slug: item.slug,
      title: item.title,
      description: item.description ?? "",
      destinationId: item.destinationId ?? "",
      status: item.status,
      publishedAt: item.publishedAt?.slice(0, 16) ?? "",
      isDemo: item.isDemo,
      mediaIds: [...item.images]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => image.mediaAssetId),
    });
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...selected];
    const target = index + direction;
    [next[index], next[target]] = [next[target]!, next[index]!];
    form.setValue("mediaIds", next, { shouldDirty: true });
  };
  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title="Gallery albums"
        description="Create public or private albums, assign destinations, and control image order."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(blankAlbum);
            }}
          >
            New album
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
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
                            onClick={() => beginEdit(item)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              question={`Archive ${item.title}?`}
                              onClick={() => archive.mutate(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() =>
                          form.setValue(
                            "mediaIds",
                            selected.filter((value) => value !== id),
                            { shouldDirty: true },
                          )
                        }
                      >
                        Remove
                      </Button>
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
                  onClick={() => {
                    setEditing(null);
                    form.reset(blankAlbum);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
