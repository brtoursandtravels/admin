import { AdminSelect } from "../components/AdminSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiRequest, privateMediaUrl, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import { DeleteRecordButton } from "../components/DeleteButton";
import { recordToForm, formToPayload } from "../lib/package-editor";
import type { PackageRecord, PackageSummary } from "../types";
import { ActionLink, Button, Card, ConfirmButton, EmptyState, ErrorPanel, LoadingPanel, PageHeader, Pagination, StatusBadge, getErrorMessage, useToast } from "../ui";

async function getPackage(id: string) {
  return apiRequest<DataResponse<PackageRecord>>(`/admin/packages/${id}`);
}

export function PackagesPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 25);
  const query = useQuery({
    queryKey: ["admin-packages", "summary", q, status, page, pageSize],
    queryFn: () =>
      apiRequest<PageResponse<PackageSummary>>(
        `/admin/packages?${new URLSearchParams({ view: "summary", ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page), pageSize: String(pageSize) })}`,
      ),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/packages/${id}`, {
        method: "DELETE",
        csrfToken,
      }),
    onSuccess: async () => {
      notify("Package archived.");
      await queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const current = (await getPackage(id)).data;
      const form = recordToForm(current);
      form.slug = `${current.slug}-copy-${Date.now().toString(36)}`;
      form.title = `Copy of ${current.title}`;
      form.status = "DRAFT";
      form.publishedAt = "";
      form.isFeatured = false;
      form.featuredOrder = "";
      return apiRequest<DataResponse<PackageRecord>>("/admin/packages", {
        method: "POST",
        csrfToken,
        body: formToPayload(form),
      });
    },
    onSuccess: async (result) => {
      notify("Draft copy created.");
      await queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      window.location.assign(`/admin/packages/${result.data.id}/edit`);
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (!("page" in updates)) next.set("page", "1");
    setParams(next);
  };
  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Tour packages"
        description="Create, edit, publish, archive and delete tour packages."
        actions={
          <ActionLink to="/packages/new">
            Create package
          </ActionLink>
        }
      />
      <div className="mb-4 grid gap-3 rounded-2xl border border-admin-border bg-admin-surface p-3 shadow-admin-card">
        <div className="flex flex-wrap items-end gap-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_input]:min-w-48 [&_select]:min-w-48">
        <label className="flex-1">
          Search packages
          <span className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 text-admin-ink-subtle" size={16} aria-hidden="true" />
            <input className="pl-9! pr-9!" value={q} onChange={(event) => updateParams({ q: event.target.value })} placeholder="Title or slug" />
            {q ? <button aria-label="Clear search" className="absolute right-2 inline-flex size-7 items-center justify-center rounded-lg border-0 bg-transparent text-admin-ink-subtle hover:bg-admin-surface-muted" onClick={() => updateParams({ q: "" })} type="button"><X size={15} /></button> : null}
          </span>
        </label>
        <label>
          Status
          <AdminSelect
            value={status}
            onValueChange={(selectedValue) => updateParams({ status: selectedValue })}
          >
            <option value="">All states</option>
            <option>DRAFT</option>
            <option>PUBLISHED</option>
            <option>ARCHIVED</option>
          </AdminSelect>
        </label>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-admin-border-soft pt-3" aria-label="Quick status filters">
          {[{ label: "All", value: "" }, { label: "Published", value: "PUBLISHED" }, { label: "Drafts", value: "DRAFT" }, { label: "Archived", value: "ARCHIVED" }].map((filter) => (
            <button className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[0.72rem] font-black transition ${status === filter.value ? "border-admin-brand bg-admin-brand text-white" : "border-admin-border bg-white text-admin-ink-muted hover:bg-admin-brand-soft"}`} key={filter.value} onClick={() => updateParams({ status: filter.value })} type="button">
              {filter.label}{status === filter.value && query.data ? ` (${query.data.meta.total})` : ""}
            </button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden p-0!">
        {query.isPending ? (
          <LoadingPanel />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title="No packages match"
            description="Change the filters or create the first package."
            action={<ActionLink to="/packages/new">Create package</ActionLink>}
          />
        ) : (
          <>
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.title}</span>
                        <small>
                          /{item.slug}
                        </small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>
                        {item.days}d / {item.nights}n
                      </td>
                      <td>
                        {item.priceBasis === "ON_REQUEST" || !item.basePrice
                          ? "On request"
                          : `${item.currency} ${Number(item.basePrice).toLocaleString("en-IN")}`}
                      </td>
                      <td>
                        {new Date(item.updatedAt).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <ActionLink
                            variant="secondary"
                            to={`/packages/${item.id}/edit`}
                          >
                            Edit
                          </ActionLink>
                          <ActionLink
                            variant="ghost"
                            to={`/packages/${item.id}/preview`}
                          >
                            Preview
                          </ActionLink>
                          <Button
                            variant="ghost"
                            disabled={duplicate.isPending}
                            onClick={() => duplicate.mutate(item.id)}
                          >
                            Duplicate
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              dialogTitle="Archive tour package?"
                              dialogDescription="This package will disappear from the public site and remain available only in archived records."
                              detailText={item.title}
                              confirmText="Archive package"
                              disabled={archive.isPending}
                              onConfirm={() => archive.mutateAsync(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                          <DeleteRecordButton
                            resource="package"
                            name={item.title}
                            description="Permanently delete this package, its itinerary, departures and package FAQs? Customer enquiries and media-library files will be kept. This cannot be undone."
                            endpoint={`/admin/packages/${item.id}/permanent`}
                            invalidateKeys={["admin-packages", "admin-package", "packages-for-relations", "faqs", "blog-posts", "media-library"]}
                            onDeleted={() => { if (query.data?.data.length === 1 && page > 1) updateParams({ page: String(page - 1) }); }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={query.data.meta}
              onPage={(next) => updateParams({ page: String(next) })}
              onPageSize={(next) => updateParams({ pageSize: String(next), page: "1" })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export { PackageEditorPage } from "./PackageEditor";

export function PackagePreviewPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["admin-package", id],
    queryFn: () => getPackage(id!),
  });
  if (query.isPending)
    return <LoadingPanel label="Preparing protected preview…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data.data;
  const cover = item.media.find((media) => media.isCover) ?? item.media[0];
  return (
    <>
      <PageHeader
        eyebrow="Protected draft preview"
        title={item.title}
        description="This preview is authenticated, noindex, and does not expose a public preview flag."
        actions={
          <Link
            className="inline-flex min-h-[2.6rem] items-center justify-center gap-2 rounded-[0.6rem] border border-transparent px-4 py-2.5 font-bold no-underline transition duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 border-admin-border bg-admin-surface text-admin-brand hover:not-disabled:bg-admin-brand-soft"
            to={`/packages/${item.id}/edit`}
          >
            Return to editor
          </Link>
        }
      />
      <article className="grid gap-4">
        <div className="grid min-h-96 grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-2xl bg-admin-brand-deep text-admin-on-brand max-[680px]:grid-cols-1 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>div:last-child]:self-center [&>div:last-child]:p-[clamp(1.5rem,4vw,3rem)] [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[clamp(1.6rem,3vw,2.6rem)] [&_h2]:text-white [&_strong]:mt-4 [&_strong]:block [&_strong]:text-[1.4rem] [&_strong]:text-white">
          {cover ? (
            <img src={privateMediaUrl(cover.id)} alt={cover.altText} />
          ) : (
            <div className="flex items-center justify-center bg-admin-brand text-admin-on-brand">No cover image selected</div>
          )}
          <div>
            <StatusBadge value={item.status} />
            <h2>{item.summary}</h2>
            <p>
              {item.days} days / {item.nights} nights ·{" "}
              {item.startingCity || "Starting city not configured"}
            </p>
            <strong>
              {item.priceBasis === "ON_REQUEST" || !item.basePrice
                ? "Price on request"
                : `${item.currency} ${Number(item.basePrice).toLocaleString("en-IN")}`}
            </strong>
          </div>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-4 max-[900px]:grid-cols-1">
          <Card>
            <h2>Overview</h2>
            <p>{item.overview}</p>
            <h2>Highlights</h2>
            <ul>
              {item.highlights.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
            <h2>Itinerary</h2>
            {item.itinerary.length ? (
              item.itinerary.map((day) => (
                <section className="grid grid-cols-[4rem_1fr] gap-4 border-t border-admin-border-soft py-4 [&>span]:text-[0.7rem] [&>span]:font-extrabold [&>span]:uppercase [&>span]:text-admin-accent" key={day.dayNumber}>
                  <span>Day {day.dayNumber}</span>
                  <div>
                    <h3>{day.title}</h3>
                    <p>{day.description}</p>
                  </div>
                </section>
              ))
            ) : (
              <p>No itinerary configured.</p>
            )}
          </Card>
          <Card>
            <h2>Request summary</h2>
            <p>
              This card previews presentation only. It never creates a booking
              or guarantees a seat.
            </p>
            <dl className="[&_div]:grid [&_div]:gap-2 [&_div]:border-t [&_div]:border-admin-border-soft [&_div]:py-3 [&_dt]:text-[0.68rem] [&_dt]:uppercase [&_dt]:text-admin-ink-muted [&_dd]:m-0">
              <div>
                <dt>Destinations</dt>
                <dd>
                  {item.destinations.map((value) => value.name).join(", ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>
                  {item.categories.map((value) => value.name).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt>Departures</dt>
                <dd>
                  {
                    item.departures.filter(
                      (value) => value.status === "SCHEDULED",
                    ).length
                  }
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </article>
    </>
  );
}
