import { FieldLabel } from "../components/FieldLabel";
import { FormSelect } from "../components/FormSelect";
import { MediaPicker } from "../components/FileUploader";
/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  apiRequest,
  type DataResponse,
} from "../api";
import { useAuth } from "../auth";
import { DeleteRecordButton } from "../components/DeleteButton";
import type { Taxonomy } from "../types";
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
const categoryFormSchema = taxonomySchema.extend({
  name: z.string().trim().min(2).max(160),
  slug: z.string(),
  description: z.string(),
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
    resolver: zodResolver(resource === "categories" ? categoryFormSchema : taxonomySchema),
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
            name: values.name,
            status: values.status,
            isDemo: values.isDemo,
            ...(resource === "destinations" ? {
              slug: values.slug,
              description: values.description || null,
              coverMediaId: values.coverMediaId || null,
            } : {}),
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
      (resource === "categories" ? item.name : `${item.name} ${item.slug}`).toLowerCase().includes(listQuery.toLowerCase());
    return matchesQuery && (!statusFilter || item.status === statusFilter);
  });
  return (
    <>
      <PageHeader
        eyebrow="Catalogue taxonomy"
        title={editorOpen ? (editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`) : title}
        description={resource === "categories" ? "Manage category names, publication state and display order." : `Manage labels, URL slugs, publication state and display order for ${title.toLowerCase()}.`}
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
              <input className="admin-control pl-9! pr-9!" onChange={(event) => setListQuery(event.target.value)} placeholder={resource === "categories" ? "Category name" : "Name or URL slug"} value={listQuery} />
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
                        {resource === "destinations" ? <small>
                          /{item.slug}
                        </small> : null}
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
              <FieldLabel required>Name</FieldLabel>
              <input aria-required="true" aria-label="Name" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </label>
            {resource === "destinations" ? <><label>
              <FieldLabel required>URL slug</FieldLabel>
              <input aria-required="true" aria-label="URL slug" {...form.register("slug")} />
              <FieldError message={form.formState.errors.slug?.message} />
            </label>
            <label>
              Description
              <textarea {...form.register("description")} />
            </label></> : null}
            {resource === "destinations" ? (
              <MediaPicker label="Place cover image" helperText="This image appears on the homepage and Destinations page." ids={form.watch("coverMediaId") ? [form.watch("coverMediaId")] : []} onChange={assets => form.setValue("coverMediaId", assets[0]?.id ?? "", { shouldDirty: true })} disabled={save.isPending} />
            ) : null}
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                <FieldLabel required>Status</FieldLabel>
                <FormSelect aria-required="true" aria-label="Status" control={form.control} name={"status"}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </FormSelect>
              </label>
              <label>
                <FieldLabel required>Display order</FieldLabel>
                <input aria-required="true" aria-label="Display order" inputMode="numeric" {...form.register("sortOrder")} />
              </label>
            </div>
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
