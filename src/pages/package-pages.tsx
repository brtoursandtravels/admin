/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Check, Circle, Search, X } from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { z } from "zod";
import {
  apiRequest,
  privateMediaUrl,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import { SeoFields } from "../components/SeoFields";
import type { MediaAsset, PackageRecord, PackageSummary, Taxonomy } from "../types";
import {
  ActionLink,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorPanel,
  FieldError,
  LoadingPanel,
  PageHeader,
  Pagination,
  StickyActionBar,
  StatusBadge,
  getErrorMessage,
  useToast,
  useUnsavedChanges,
} from "../ui";

const listText = z.string().max(20_000);
const itineraryItem = z.object({
  dayNumber: z.string().regex(/^\d+$/, "Use a day number."),
  title: z.string().min(1, "Add a title."),
  description: z.string().min(1, "Add a description."),
  activitiesText: listText,
  meals: z.string(),
  accommodation: z.string(),
});
const departureItem = z
  .object({
    startDate: z.string().min(1, "Choose a start date."),
    endDate: z.string().min(1, "Choose an end date."),
    pricePerPerson: z.string(),
    currency: z.string().length(3, "Use a 3-letter currency."),
    status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]),
    note: z.string().max(500),
  })
  .refine((item) => item.endDate >= item.startDate, {
    path: ["endDate"],
    message: "End date must follow the start date.",
  });
const packageFormSchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(180)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase words separated by hyphens.",
      ),
    title: z.string().min(2).max(200),
    summary: z.string().min(10).max(500),
    overview: z.string().min(20).max(30_000),
    days: z.string().regex(/^\d+$/, "Use a whole number."),
    nights: z.string().regex(/^\d+$/, "Use a whole number."),
    startingCity: z.string(),
    basePrice: z.string(),
    currency: z.string().length(3),
    priceBasis: z.enum(["PER_PERSON", "PER_GROUP", "PER_ROOM", "ON_REQUEST"]),
    highlightsText: listText,
    inclusionsText: listText,
    exclusionsText: listText,
    transportInformation: z.string(),
    accommodationNotes: z.string(),
    importantInformation: z.string(),
    cancellationRules: z.string(),
    seoTitle: z.string().max(70),
    seoDescription: z.string().max(170),
    brochureMediaId: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    publishedAt: z.string(),
    isFeatured: z.boolean(),
    featuredOrder: z.string(),
    isDemo: z.boolean(),
    destinationsText: z.string().max(4_000).superRefine((value, context) => {
      const names = lines(value);
      if (names.length > 20) context.addIssue({ code: "custom", message: "Add up to 20 destinations." });
      if (names.some((name) => name.length > 160)) context.addIssue({ code: "custom", message: "Keep each destination within 160 characters." });
    }),
    categoryIds: z.array(z.string()),
    itinerary: z.array(itineraryItem),
    departures: z.array(departureItem),
    media: z.array(
      z.object({
        mediaAssetId: z.string(),
        sortOrder: z.number(),
        isCover: z.boolean(),
      }),
    ),
  })
  .superRefine((value, context) => {
    if (Number(value.nights) > Number(value.days))
      context.addIssue({
        code: "custom",
        path: ["nights"],
        message: "Nights cannot exceed days.",
      });
    if (
      value.priceBasis !== "ON_REQUEST" &&
      (!value.basePrice || Number(value.basePrice) < 0)
    )
      context.addIssue({
        code: "custom",
        path: ["basePrice"],
        message: "Add a valid base price or choose price on request.",
      });
    if (value.media.filter((item) => item.isCover).length > 1)
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Choose only one cover image.",
      });
  });
type PackageForm = z.infer<typeof packageFormSchema>;

const blankForm: PackageForm = {
  slug: "",
  title: "",
  summary: "",
  overview: "",
  days: "1",
  nights: "0",
  startingCity: "",
  basePrice: "",
  currency: "INR",
  priceBasis: "ON_REQUEST",
  highlightsText: "",
  inclusionsText: "",
  exclusionsText: "",
  transportInformation: "",
  accommodationNotes: "",
  importantInformation: "",
  cancellationRules: "",
  seoTitle: "",
  seoDescription: "",
  brochureMediaId: "",
  status: "DRAFT",
  publishedAt: "",
  isFeatured: false,
  featuredOrder: "",
  isDemo: false,
  destinationsText: "",
  categoryIds: [],
  itinerary: [],
  departures: [],
  media: [],
};
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const text = (value: string | null | undefined) => value ?? "";
const joinLines = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";

function recordToForm(record: PackageRecord): PackageForm {
  return {
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    overview: record.overview,
    days: String(record.days),
    nights: String(record.nights),
    startingCity: text(record.startingCity),
    basePrice: text(record.basePrice),
    currency: record.currency,
    priceBasis: record.priceBasis,
    highlightsText: joinLines(record.highlights),
    inclusionsText: joinLines(record.inclusions),
    exclusionsText: joinLines(record.exclusions),
    transportInformation: text(record.transportInformation),
    accommodationNotes: text(record.accommodationNotes),
    importantInformation: text(record.importantInformation),
    cancellationRules: text(record.cancellationRules),
    seoTitle: text(record.seoTitle),
    seoDescription: text(record.seoDescription),
    brochureMediaId: record.brochure?.id ?? "",
    status: record.status,
    publishedAt: record.publishedAt?.slice(0, 16) ?? "",
    isFeatured: record.isFeatured,
    featuredOrder:
      record.featuredOrder === null ? "" : String(record.featuredOrder),
    isDemo: record.isDemo,
    destinationsText: record.destinations.map((item) => item.name).join("\n"),
    categoryIds: record.categories.map((item) => item.id),
    itinerary: record.itinerary.map((item) => ({
      dayNumber: String(item.dayNumber),
      title: item.title,
      description: item.description,
      activitiesText: joinLines(item.activities),
      meals: text(item.meals),
      accommodation: text(item.accommodation),
    })),
    departures: record.departures.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      pricePerPerson: text(item.pricePerPerson),
      currency: item.currency,
      status: item.status,
      note: text(item.note),
    })),
    media: record.media.map((item) => ({
      mediaAssetId: item.id,
      sortOrder: item.sortOrder,
      isCover: item.isCover,
    })),
  };
}

function formToPayload(value: PackageForm) {
  return {
    slug: value.slug,
    title: value.title,
    summary: value.summary,
    overview: value.overview,
    days: Number(value.days),
    nights: Number(value.nights),
    startingCity: value.startingCity || null,
    basePrice:
      value.priceBasis === "ON_REQUEST" || !value.basePrice
        ? null
        : Number(value.basePrice),
    currency: value.currency.toUpperCase(),
    priceBasis: value.priceBasis,
    highlights: lines(value.highlightsText),
    inclusions: lines(value.inclusionsText),
    exclusions: lines(value.exclusionsText),
    transportInformation: value.transportInformation || null,
    accommodationNotes: value.accommodationNotes || null,
    importantInformation: value.importantInformation || null,
    cancellationRules: value.cancellationRules || null,
    seoTitle: value.seoTitle.trim() || null,
    seoDescription: value.seoDescription.trim() || null,
    brochureMediaId: value.brochureMediaId || null,
    status: value.status,
    publishedAt: value.publishedAt
      ? new Date(value.publishedAt).toISOString()
      : null,
    isFeatured: value.isFeatured,
    featuredOrder:
      value.isFeatured && value.featuredOrder
        ? Number(value.featuredOrder)
        : null,
    isDemo: value.isDemo,
    destinationNames: lines(value.destinationsText),
    categoryIds: value.categoryIds,
    itinerary: value.itinerary.map((item, index) => ({
      dayNumber: index + 1,
      title: item.title,
      description: item.description,
      activities: lines(item.activitiesText),
      meals: item.meals || null,
      accommodation: item.accommodation || null,
    })),
    departures: value.departures.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      pricePerPerson: item.pricePerPerson ? Number(item.pricePerPerson) : null,
      currency: item.currency.toUpperCase(),
      status: item.status,
      note: item.note || null,
    })),
    media: value.media.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

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
        description="Search, edit, preview, publish and archive database-backed packages."
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
          <select
            value={status}
            onChange={(event) => updateParams({ status: event.target.value })}
          >
            <option value="">All states</option>
            <option>DRAFT</option>
            <option>PUBLISHED</option>
            <option>ARCHIVED</option>
          </select>
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
                          {item.isDemo ? " · Demo" : ""}
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

const tabs = [
  "Basics",
  "Content",
  "Itinerary",
  "Departures",
  "Media",
  "Policies",
  "Publishing",
] as const;
export function PackageEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Basics");
  const [mediaChoice, setMediaChoice] = useState("");
  const form = useForm<PackageForm>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: blankForm,
  });
  useUnsavedChanges(
    form.formState.isDirty && !form.formState.isSubmitSuccessful,
  );
  const packageQuery = useQuery({
    queryKey: ["admin-package", id],
    queryFn: () => getPackage(id!),
    enabled: editing,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiRequest<DataResponse<Taxonomy[]>>("/admin/categories"),
  });
  const mediaLibrary = useQuery({
    queryKey: ["media-library", "editor"],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>("/admin/media?pageSize=100"),
  });
  useEffect(() => {
    if (packageQuery.data) form.reset(recordToForm(packageQuery.data.data));
  }, [form, packageQuery.data]);
  const itinerary = useFieldArray({ control: form.control, name: "itinerary" });
  const departures = useFieldArray({
    control: form.control,
    name: "departures",
  });
  const media = useFieldArray({ control: form.control, name: "media" });
  const save = useMutation({
    mutationFn: (values: PackageForm) =>
      apiRequest<DataResponse<PackageRecord>>(
        editing ? `/admin/packages/${id}` : "/admin/packages",
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: formToPayload(values),
        },
      ),
    onSuccess: async (result) => {
      form.reset(recordToForm(result.data));
      notify(
        editing
          ? "Package saved."
          : "Package created as a real database record.",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      await queryClient.invalidateQueries({ queryKey: ["destinations"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!editing)
        navigate(`/packages/${result.data.id}/edit`, { replace: true });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const editorValues = form.watch();
  const selectedMedia = editorValues.media;
  const tabCompletion: Record<(typeof tabs)[number], boolean> = {
    Basics: Boolean(editorValues.title && editorValues.slug && editorValues.days),
    Content: Boolean(editorValues.summary && editorValues.overview),
    Itinerary:
      editorValues.itinerary.length > 0 &&
      editorValues.itinerary.length >= Number(editorValues.days || 0),
    Departures: editorValues.departures.length > 0,
    Media: editorValues.media.length > 0,
    Policies: Boolean(editorValues.importantInformation || editorValues.cancellationRules),
    Publishing: Boolean(editorValues.status),
  };
  const assetById = useMemo(
    () =>
      new Map(mediaLibrary.data?.data.map((asset) => [asset.id, asset]) ?? []),
    [mediaLibrary.data],
  );
  if (editing && packageQuery.isPending)
    return <LoadingPanel label="Loading package editor…" />;
  if (editing && packageQuery.isError)
    return (
      <ErrorPanel
        error={packageQuery.error}
        retry={() => void packageQuery.refetch()}
      />
    );
  const multiSelect = (
    field: "categoryIds",
    values: string[],
  ) => (
    <select
      multiple
      value={form.watch(field)}
      onChange={(event) =>
        form.setValue(
          field,
          Array.from(
            event.currentTarget.selectedOptions,
            (option) => option.value,
          ),
          { shouldDirty: true },
        )
      }
    >
      {values.map((value) => {
        const record = categories.data?.data.find((item) => item.id === value);
        return record ? (
          <option key={record.id} value={record.id}>
            {record.name} · {record.status}
          </option>
        ) : null;
      })}
    </select>
  );
  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <PageHeader
        eyebrow="Package editor"
        title={
          editing ? form.watch("title") || "Edit package" : "Create package"
        }
        description="All changes persist through the protected Express API. Preview stays inside this authenticated admin."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/packages")}
            >
              Back
            </Button>
            {editing ? (
              <ActionLink
                variant="secondary"
                to={`/packages/${id}/preview`}
              >
                Protected preview
              </ActionLink>
            ) : null}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save package"}
            </Button>
          </>
        }
      />
      {save.isError ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          {getErrorMessage(save.error)}
        </div>
      ) : null}
      <div
        className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-admin-border bg-admin-surface p-2 shadow-admin-card [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:whitespace-nowrap [&_button]:rounded-xl [&_button]:border [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2.5 [&_button]:text-[0.72rem] [&_button]:font-black [&_button]:text-admin-ink-muted"
        role="tablist"
        aria-label="Package editor sections"
      >
        {tabs.map((item) => (
          <button
            aria-selected={tab === item}
            className={
              tab === item
                ? "border-admin-brand! bg-admin-brand! text-white!"
                : ""
            }
            key={item}
            onClick={() => setTab(item)}
            role="tab"
            type="button"
          >
            <span className={`inline-flex size-5 items-center justify-center rounded-full ${tabCompletion[item] ? "bg-admin-positive-soft text-admin-positive" : "bg-admin-surface-muted text-admin-ink-subtle"}`}>
              {tabCompletion[item] ? <Check size={12} aria-hidden="true" /> : <Circle size={8} aria-hidden="true" />}
            </span>
            {item}
          </button>
        ))}
      </div>
      <Card className="admin-tab-panel min-h-[28rem]" key={tab}>
        {tab === "Basics" ? (
          <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
            <label>
              Title
              <input {...form.register("title")} />
              <FieldError message={form.formState.errors.title?.message} />
            </label>
            <label>
              URL slug
              <input {...form.register("slug")} />
              <FieldError message={form.formState.errors.slug?.message} />
            </label>
            <label>
              Days
              <input inputMode="numeric" {...form.register("days")} />
              <FieldError message={form.formState.errors.days?.message} />
            </label>
            <label>
              Nights
              <input inputMode="numeric" {...form.register("nights")} />
              <FieldError message={form.formState.errors.nights?.message} />
            </label>
            <label>
              Starting city
              <input {...form.register("startingCity")} />
            </label>
            <label>
              Price basis
              <select {...form.register("priceBasis")}>
                <option value="ON_REQUEST">Price on request</option>
                <option value="PER_PERSON">Per person</option>
                <option value="PER_GROUP">Per group</option>
                <option value="PER_ROOM">Per room</option>
              </select>
            </label>
            <label>
              Base price
              <input
                inputMode="decimal"
                disabled={form.watch("priceBasis") === "ON_REQUEST"}
                {...form.register("basePrice")}
              />
              <FieldError message={form.formState.errors.basePrice?.message} />
            </label>
            <label>
              Currency
              <input maxLength={3} {...form.register("currency")} />
            </label>
            <label>
              Destinations
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                Type one destination per line. No separate setup is needed.
              </span>
              <textarea rows={4} placeholder={"Matheran\nMahabaleshwar"} {...form.register("destinationsText")} />
              <FieldError message={form.formState.errors.destinationsText?.message} />
            </label>
            <label>
              Categories
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                Hold Ctrl/Command to select multiple.
              </span>
              {multiSelect(
                "categoryIds",
                categories.data?.data.map((item) => item.id) ?? [],
              )}
            </label>
          </div>
        ) : null}
        {tab === "Content" ? (
          <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
            <label className="col-span-full max-[680px]:col-auto">
              Summary
              <textarea rows={3} {...form.register("summary")} />
              <FieldError message={form.formState.errors.summary?.message} />
            </label>
            <label className="col-span-full max-[680px]:col-auto">
              Overview
              <textarea {...form.register("overview")} />
              <FieldError message={form.formState.errors.overview?.message} />
            </label>
            <label>
              Highlights<span className="text-[0.68rem] font-normal text-admin-ink-subtle">One item per line.</span>
              <textarea {...form.register("highlightsText")} />
            </label>
            <label>
              Inclusions<span className="text-[0.68rem] font-normal text-admin-ink-subtle">One item per line.</span>
              <textarea {...form.register("inclusionsText")} />
            </label>
            <label>
              Exclusions<span className="text-[0.68rem] font-normal text-admin-ink-subtle">One item per line.</span>
              <textarea {...form.register("exclusionsText")} />
            </label>
            <label>
              Transport and pickup information
              <textarea {...form.register("transportInformation")} />
            </label>
            <label className="col-span-full max-[680px]:col-auto">
              Accommodation notes
              <textarea {...form.register("accommodationNotes")} />
            </label>
          </div>
        ) : null}
        {tab === "Itinerary" ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start [&_p]:mb-0 [&_p]:text-admin-ink-muted">
              <div>
                <h2>Day-by-day itinerary</h2>
                <p>Order is saved as consecutive day numbers.</p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  itinerary.append({
                    dayNumber: String(itinerary.fields.length + 1),
                    title: "",
                    description: "",
                    activitiesText: "",
                    meals: "",
                    accommodation: "",
                  })
                }
              >
                Add day
              </Button>
            </div>
            {itinerary.fields.length === 0 ? (
              <EmptyState
                title="No itinerary days"
                description="Add the first day when the package itinerary is known."
              />
            ) : (
              itinerary.fields.map((field, index) => (
                <fieldset className="relative m-0 rounded-xl border border-admin-border p-4 [&_legend]:px-1.5 [&_legend]:text-[0.72rem] [&_legend]:font-extrabold [&_legend]:uppercase [&_legend]:text-admin-accent" key={field.id}>
                  <legend>Day {index + 1}</legend>
                  <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => itinerary.move(index, index - 1)}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === itinerary.fields.length - 1}
                      onClick={() => itinerary.move(index, index + 1)}
                    >
                      Move down
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => itinerary.remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
                    <label>
                      Title
                      <input {...form.register(`itinerary.${index}.title`)} />
                    </label>
                    <label>
                      Meals
                      <input {...form.register(`itinerary.${index}.meals`)} />
                    </label>
                    <label className="col-span-full max-[680px]:col-auto">
                      Description
                      <textarea
                        {...form.register(`itinerary.${index}.description`)}
                      />
                    </label>
                    <label>
                      Activities
                      <span className="text-[0.68rem] font-normal text-admin-ink-subtle">One per line.</span>
                      <textarea
                        {...form.register(`itinerary.${index}.activitiesText`)}
                      />
                    </label>
                    <label>
                      Accommodation
                      <input
                        {...form.register(`itinerary.${index}.accommodation`)}
                      />
                    </label>
                  </div>
                </fieldset>
              ))
            )}
          </div>
        ) : null}
        {tab === "Departures" ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start [&_p]:mb-0 [&_p]:text-admin-ink-muted">
              <div>
                <h2>Departures and pricing</h2>
                <p>
                  Dates represent request options, not guaranteed inventory.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  departures.append({
                    startDate: "",
                    endDate: "",
                    pricePerPerson: "",
                    currency: "INR",
                    status: "SCHEDULED",
                    note: "",
                  })
                }
              >
                Add departure
              </Button>
            </div>
            {departures.fields.length === 0 ? (
              <EmptyState
                title="No departure dates"
                description="The public page will not imply fixed availability."
              />
            ) : (
              departures.fields.map((field, index) => (
                <fieldset className="relative m-0 rounded-xl border border-admin-border p-4 [&_legend]:px-1.5 [&_legend]:text-[0.72rem] [&_legend]:font-extrabold [&_legend]:uppercase [&_legend]:text-admin-accent" key={field.id}>
                  <legend>Departure {index + 1}</legend>
                  <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => departures.remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
                    <label>
                      Start date
                      <input
                        type="date"
                        {...form.register(`departures.${index}.startDate`)}
                      />
                    </label>
                    <label>
                      End date
                      <input
                        type="date"
                        {...form.register(`departures.${index}.endDate`)}
                      />
                    </label>
                    <label>
                      Price per person
                      <input
                        inputMode="decimal"
                        {...form.register(`departures.${index}.pricePerPerson`)}
                      />
                    </label>
                    <label>
                      Currency
                      <input
                        maxLength={3}
                        {...form.register(`departures.${index}.currency`)}
                      />
                    </label>
                    <label>
                      Status
                      <select {...form.register(`departures.${index}.status`)}>
                        <option>SCHEDULED</option>
                        <option>CANCELLED</option>
                        <option>COMPLETED</option>
                      </select>
                    </label>
                    <label>
                      Internal/public note
                      <input {...form.register(`departures.${index}.note`)} />
                    </label>
                  </div>
                </fieldset>
              ))
            )}
          </div>
        ) : null}
        {tab === "Media" ? (
          <div>
            <div className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start [&_p]:mb-0 [&_p]:text-admin-ink-muted">
              <div>
                <h2>Package gallery</h2>
                <p>Select existing, validated media and order it below.</p>
              </div>
              <div className="flex items-center gap-2 max-[680px]:w-full max-[680px]:flex-col max-[680px]:items-stretch [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_select]:min-w-60">
                <select
                  value={mediaChoice}
                  onChange={(event) => setMediaChoice(event.target.value)}
                >
                  <option value="">Choose media…</option>
                  {mediaLibrary.data?.data
                    .filter(
                      (asset) =>
                        asset.mimeType.startsWith("image/") &&
                        !selectedMedia.some(
                          (item) => item.mediaAssetId === asset.id,
                        ),
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
                    media.append({
                      mediaAssetId: mediaChoice,
                      sortOrder: media.fields.length,
                      isCover: media.fields.length === 0,
                    });
                    setMediaChoice("");
                  }}
                >
                  Add
                </Button>
                <Link
                  className="inline-flex min-h-[2.6rem] items-center justify-center rounded-[0.6rem] border border-admin-border bg-admin-surface px-4 py-2.5 text-sm font-bold no-underline transition hover:bg-admin-brand-soft"
                  to="/media/new"
                >
                  Upload image
                </Link>
              </div>
            </div>
            {media.fields.length === 0 ? (
              <EmptyState
                title="No package media"
                description="Upload assets in the media library, then select them here."
                action={
                  <Link className="inline-flex min-h-[2.6rem] items-center justify-center gap-2 rounded-[0.6rem] border border-transparent px-4 py-2.5 font-bold no-underline transition duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 border-admin-border bg-admin-surface text-admin-brand hover:not-disabled:bg-admin-brand-soft" to="/media/new">
                    Upload package image
                  </Link>
                }
              />
            ) : (
              <div className="mt-4 grid gap-3 [&_article]:grid [&_article]:grid-cols-[5rem_1fr_auto] [&_article]:items-center [&_article]:gap-4 [&_article]:rounded-[0.7rem] [&_article]:border [&_article]:border-admin-border [&_article]:p-3 max-[680px]:[&_article]:grid-cols-[4rem_1fr] [&_img]:aspect-square [&_img]:h-20 [&_img]:w-20 [&_img]:rounded-[0.45rem] [&_img]:object-cover max-[680px]:[&_img]:h-16 max-[680px]:[&_img]:w-16">
                {media.fields.map((field, index) => {
                  const asset = assetById.get(field.mediaAssetId);
                  return (
                    <article key={field.id}>
                      <img
                        src={privateMediaUrl(field.mediaAssetId)}
                        alt={asset?.altText ?? "Package media"}
                      />
                      <div>
                        <strong>{asset?.altText ?? field.mediaAssetId}</strong>
                        <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
                          <input
                            type="radio"
                            name="cover"
                            checked={form.watch(`media.${index}.isCover`)}
                            onChange={() =>
                              selectedMedia.forEach((_, itemIndex) =>
                                form.setValue(
                                  `media.${itemIndex}.isCover`,
                                  itemIndex === index,
                                  { shouldDirty: true },
                                ),
                              )
                            }
                          />{" "}
                          Cover image
                        </label>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => media.move(index, index - 1)}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={index === media.fields.length - 1}
                          onClick={() => media.move(index, index + 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => media.remove(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        {tab === "Policies" ? (
          <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
            <label className="col-span-full max-[680px]:col-auto">
              Important information
              <textarea {...form.register("importantInformation")} />
            </label>
            <label className="col-span-full max-[680px]:col-auto">
              Cancellation rules
              <textarea {...form.register("cancellationRules")} />
            </label>
            <label className="col-span-full max-[680px]:col-auto">
              Downloadable brochure
              <select {...form.register("brochureMediaId")}>
                <option value="">No brochure</option>
                {mediaLibrary.data?.data
                  .filter((asset) => asset.mimeType === "application/pdf")
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.altText}
                    </option>
                  ))}
              </select>
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                Upload a validated PDF in the media library first.
              </span>
            </label>
            <div className="col-span-full rounded-[0.65rem] bg-admin-surface-muted p-4 text-admin-ink-muted max-[680px]:col-auto [&_p]:my-1">
              <strong>Package FAQs</strong>
              <p>
                Package-specific questions are assigned in the FAQ manager after
                this package is saved.
              </p>
              <Link to="/content/engagement">Open FAQ manager →</Link>
            </div>
          </div>
        ) : null}
        {tab === "Publishing" ? (
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
              Publish date and time
              <input type="datetime-local" {...form.register("publishedAt")} />
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                Leave empty to publish immediately.
              </span>
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isFeatured")} /> Feature
              this package
            </label>
            <label>
              Featured order
              <input
                inputMode="numeric"
                disabled={!form.watch("isFeatured")}
                {...form.register("featuredOrder")}
              />
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Mark as
              development demo content
            </label>
            <div className="col-span-full rounded-[0.65rem] bg-admin-surface-muted p-4 text-admin-ink-muted max-[680px]:col-auto [&_p]:my-1">
              <strong>
                {form.watch("status") === "PUBLISHED"
                  ? "This package can become public after save."
                  : "This package remains private."}
              </strong>
              <p>
                Publication eligibility is enforced by the API, including dates
                and production demo rules.
              </p>
            </div>
          </div>
        ) : null}
      </Card>
      <Card className="mt-4">
        <SeoFields
          titleField={form.register("seoTitle")}
          descriptionField={form.register("seoDescription")}
          titleValue={editorValues.seoTitle}
          descriptionValue={editorValues.seoDescription}
          fallbackTitle={editorValues.title}
          fallbackDescription={editorValues.summary}
          titleError={form.formState.errors.seoTitle?.message}
          descriptionError={form.formState.errors.seoDescription?.message}
        />
      </Card>
      <StickyActionBar dirty={form.formState.isDirty} saving={save.isPending}>
        {form.formState.isDirty ? (
          <ConfirmButton
            cancelText="Keep editing"
            confirmText="Discard changes"
            dialogDescription="Revert every unsaved change made in this editing session?"
            dialogTitle="Discard package changes?"
            onConfirm={() =>
              form.reset(
                packageQuery.data
                  ? recordToForm(packageQuery.data.data)
                  : blankForm,
              )
            }
            tone="warning"
          >
            Discard
          </ConfirmButton>
        ) : null}
        <Button
          disabled={save.isPending}
          onClick={() => {
            form.setValue("status", "DRAFT", { shouldDirty: true });
            void form.handleSubmit((values) => save.mutate(values))();
          }}
          type="button"
          variant="secondary"
        >
          Save as draft
        </Button>
        <Button
          disabled={save.isPending || !form.formState.isDirty}
          type="submit"
        >
          {save.isPending
            ? "Saving…"
            : editorValues.status === "PUBLISHED"
              ? "Publish changes"
              : "Save changes"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

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
