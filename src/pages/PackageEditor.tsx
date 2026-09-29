import { FieldLabel } from "../components/FieldLabel";
import { FormSelect } from "../components/FormSelect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { Check, Circle, CircleAlert, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest, privateMediaUrl, type DataResponse } from "../api";
import { useAuth } from "../auth";
import type { MediaAsset, PackageRecord, Taxonomy } from "../types";
import { blankForm, formToPayload, overviewExcerpt, packageFormSchema, recordToForm, type PackageForm } from "../lib/package-editor";
import { DeleteButton } from "../components/DeleteButton";
import { MediaPicker } from "../components/FileUploader";
import { ListEditor } from "../components/ListEditor";
import { SeoFields } from "../components/SeoFields";
import { Button, Card, ConfirmButton, ErrorPanel, FieldError, LoadingPanel, PageHeader, StickyActionBar, getErrorMessage, useConfirm, useToast, useUnsavedChanges } from "../ui";

const tabs = ["Basics", "Content", "Itinerary", "Departures", "Media", "Policies", "Publishing"] as const;
type Tab = typeof tabs[number];
const fields: Record<Tab, FieldPath<PackageForm>[]> = {
  Basics: ["title", "slug", "days", "nights", "startingCity", "priceBasis", "basePrice", "currency", "categoryIds", "destinationsText"],
  Content: ["overview", "highlightsText", "inclusionsText", "exclusionsText", "transportInformation", "accommodationNotes"],
  Itinerary: ["itinerary"], Departures: ["departures"], Media: ["media"], Policies: ["brochureMediaId", "importantInformation", "cancellationRules"],
  Publishing: ["status", "publishedAt", "isFeatured", "featuredOrder", "seoTitle", "seoDescription"],
};
const slugify = (title: string) => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180).replace(/-$/g, "");
const emptyDay = (number: number) => ({ dayNumber: String(number), title: "", description: "", activitiesText: "", meals: "", accommodation: "", imageMediaId: "" });
const endDate = (start: string, days: number) => { const date = new Date(`${start}T00:00:00Z`); if (!Number.isFinite(date.getTime()) || !Number.isFinite(days)) return ""; date.setUTCDate(date.getUTCDate() + Math.max(0, days - 1)); return date.toISOString().slice(0, 10); };

export function PackageEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { csrfToken, publicSiteUrl } = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("Basics");
  const [slugUnlocked, setSlugUnlocked] = useState(editing);
  const [nightsManual, setNightsManual] = useState(editing);
  const [preview, setPreview] = useState(false);
  const [busyFiles, setBusyFiles] = useState(0);
  const [fixedDates, setFixedDates] = useState(false);
  const [visited, setVisited] = useState<Tab[]>([]);
  const loadedId = useRef<string | null>(null);
  const form = useForm<PackageForm>({ resolver: zodResolver(packageFormSchema), defaultValues: blankForm, mode: "onBlur" });
  const values = form.watch();
  const description = overviewExcerpt(values.overview);
  useUnsavedChanges(form.formState.isDirty || busyFiles > 0);
  const packageQuery = useQuery({ queryKey: ["admin-package", id], queryFn: () => apiRequest<DataResponse<PackageRecord>>(`/admin/packages/${id}`), enabled: editing });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiRequest<DataResponse<Taxonomy[]>>("/admin/categories") });
  useEffect(() => {
    const record = packageQuery.data?.data;
    if (!record || loadedId.current === record.id) return;
    loadedId.current = record.id;
    form.reset(recordToForm(record));
    setFixedDates(record.departures.length > 0);
    for (const asset of [...record.media, ...(record.brochure ? [record.brochure] : []), ...record.itinerary.flatMap(day => day.image ? [day.image] : [])]) {
      if (asset.mimeType) client.setQueryData(["media-asset", asset.id], { data: asset });
    }
  }, [packageQuery.data, form, client]);
  const itinerary = useFieldArray({ control: form.control, name: "itinerary" });
  const departures = useFieldArray({ control: form.control, name: "departures" });
  const fileBusy = (busy: boolean) => setBusyFiles(value => Math.max(0, value + (busy ? 1 : -1)));
  const setText = (field: FieldPath<PackageForm>, value: string) => form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
  const issues = packageFormSchema.safeParse(values);
  const tabErrors = (name: Tab) => !issues.success && issues.error.issues.some(issue => fields[name].some(field => field === issue.path[0]));
  const coverId = values.media.find(item => item.isCover)?.mediaAssetId;
  // Observe the cover on every tab so cache expiry and metadata updates cannot
  // leave the publishing checklist with missing or stale image details.
  const coverQuery = useQuery({
    queryKey: ["media-asset", coverId],
    queryFn: () => apiRequest<DataResponse<MediaAsset>>(`/admin/media/${coverId}`),
    enabled: Boolean(coverId),
    staleTime: 60_000,
  });
  const cover = coverQuery.data?.data;
  const checkingCover = Boolean(coverId && coverQuery.isPending);
  const packagePath = `/packages/${encodeURIComponent(values.slug)}`;
  const publicUrl = publicSiteUrl ? new URL(packagePath, publicSiteUrl).toString() : packagePath;
  const readiness = [
    { label: "Basic information completed", ready: !tabErrors("Basics"), tab: "Basics" as Tab },
    { label: "Overview completed", ready: description.length >= 20, tab: "Content" as Tab },
    { label: "Public cover image selected", ready: Boolean(coverId && !coverQuery.isError && cover?.visibility === "PUBLIC" && cover.mimeType.startsWith("image/")), tab: "Media" as Tab, pending: checkingCover },
    { label: "Itinerary matches package duration", ready: values.itinerary.length === Number(values.days) && values.itinerary.every(day => day.title.trim() && day.description.trim()) && !tabErrors("Itinerary"), tab: "Itinerary" as Tab },
    { label: "Inclusions and exclusions added", ready: Boolean(values.inclusionsText.trim() && values.exclusionsText.trim()), tab: "Content" as Tab },
    { label: "Policy templates reviewed", ready: !/\[enter [^\]]+\]/i.test(values.cancellationRules + values.importantInformation), tab: "Policies" as Tab },
  ];
  const completion: Record<Tab, boolean> = {
    Basics: !tabErrors("Basics"), Content: readiness[1]!.ready && readiness[4]!.ready,
    Itinerary: readiness[3]!.ready, Departures: !tabErrors("Departures") && (!fixedDates || values.departures.length > 0),
    Media: readiness[2]!.ready, Policies: Boolean(values.importantInformation || values.cancellationRules || values.brochureMediaId),
    Publishing: readiness.every(item => item.ready),
  };
  const save = useMutation({
    mutationFn: (data: PackageForm) => apiRequest<DataResponse<PackageRecord>>(editing ? `/admin/packages/${id}` : "/admin/packages", { method: editing ? "PUT" : "POST", csrfToken, body: formToPayload(data) }),
    onSuccess: async result => {
      form.reset(recordToForm(result.data));
      client.setQueryData(["admin-package", result.data.id], result);
      notify(result.data.status === "PUBLISHED" ? "Package published." : "Package saved.");
      await Promise.all(["admin-packages", "destinations", "dashboard"].map(key => client.invalidateQueries({ queryKey: [key] })));
      if (!editing) navigate(`/packages/${result.data.id}/edit`, { replace: true });
    },
    onError: error => notify(getErrorMessage(error), "error"),
  });
  const locked = save.isPending || busyFiles > 0;
  async function submit(status = values.status) {
    if (locked) return;
    form.setValue("status", status, { shouldDirty: true });
    if (!await form.trigger()) {
      const result = packageFormSchema.safeParse(form.getValues());
      const first = result.success ? null : result.error.issues[0];
      if (first) setTab(tabs.find(name => fields[name].some(field => field === first.path[0])) ?? "Basics");
      setVisited([...tabs]); notify("Review the highlighted fields before saving.", "error"); return;
    }
    if (status === "PUBLISHED" && readiness.some(item => !item.ready)) { setTab("Publishing"); notify("Complete the publishing checklist first.", "error"); return; }
    save.mutate(form.getValues());
  }
  async function nextTab(next: Tab) {
    if (busyFiles) { notify("Wait for the file upload to finish.", "error"); return; }
    if (!editing && tabs.indexOf(next) > tabs.indexOf(tab)) {
      setVisited(items => [...new Set([...items, tab])]);
      if (!await form.trigger(fields[tab])) { notify("Complete this step before continuing.", "error"); return; }
      if (tab === "Content" && !readiness[1]!.ready) { notify("Add an overview before continuing.", "error"); return; }
    }
    setTab(next);
  }
  async function applyTemplate(field: "importantInformation" | "cancellationRules", template: string) {
    if (form.getValues(field) && !await confirm({ title: "Replace this text?", message: "The template replaces your current text. You can edit it before saving.", confirmText: "Use template", tone: "warning" })) return;
    setText(field, template);
  }
  if (editing && packageQuery.isPending) return <LoadingPanel label="Loading package editor…" />;
  if (editing && packageQuery.isError) return <ErrorPanel error={packageQuery.error} retry={() => void packageQuery.refetch()} />;
  const index = tabs.indexOf(tab);
  const input = (name: keyof PackageForm, label: string, type = "text", required = name === "basePrice" && values.priceBasis !== "ON_REQUEST") => <label className="editor-field"><FieldLabel required={required}>{label}</FieldLabel><input aria-required={required} className="admin-control" aria-label={label} type={type} {...form.register(name)} /><FieldError message={form.formState.errors[name]?.message} /></label>;
  const textarea = (name: "overview" | "destinationsText" | "transportInformation" | "accommodationNotes" | "importantInformation" | "cancellationRules", label: string, max = 20000, required = name === "overview" && (!editing || values.status === "PUBLISHED")) => <label className="editor-field"><FieldLabel required={required}>{label}</FieldLabel><textarea aria-required={required} className="admin-control" aria-label={label} rows={name === "overview" ? 7 : 4} maxLength={max} {...form.register(name)} /><span className="text-xs font-normal text-admin-ink-subtle">{values[name].length}/{max} characters</span><FieldError message={form.formState.errors[name]?.message} /></label>;
  return <form className={`package-editor ${preview ? "xl:pr-[28rem]" : ""}`} noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
    <PageHeader eyebrow={editing ? "Package editor" : `Create package · Step ${index + 1} of ${tabs.length}`} title={editing ? values.title || "Edit package" : "Create package"} description="Build the journey, add photos and review everything before publishing." actions={<><Button type="button" variant="secondary" onClick={() => navigate("/packages")}>Back to packages</Button><Button type="button" variant="secondary" onClick={() => setPreview(true)}>Preview live card</Button></>} />
    {save.isError ? <ErrorPanel error={save.error} /> : null}
    <div role="tablist" aria-label="Package editor sections" className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-admin-border bg-admin-surface p-2">
      {tabs.map((name, i) => <button key={name} type="button" role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={tab === name} onClick={() => void nextTab(name)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-xs font-bold ${tab === name ? "bg-admin-brand text-white" : "text-admin-brand-deep"}`}>
        {visited.includes(name) && tabErrors(name) ? <CircleAlert size={16} className="text-admin-negative" /> : completion[name] ? <Check size={16} className={tab === name ? "text-white" : "text-admin-positive"} /> : <Circle size={13} />} {!editing ? `${i + 1}. ` : ""}{name}
      </button>)}
    </div>
    <Card className="min-h-96">
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="grid gap-5">
      {tab === "Basics" ? <>
        <div className="editor-grid">
          <label className="editor-field"><FieldLabel required>Title</FieldLabel><input aria-required="true" className="admin-control" aria-label="Title" {...form.register("title", { onChange: event => { if (!slugUnlocked) form.setValue("slug", slugify(event.target.value), { shouldDirty: true }); } })} /><FieldError message={form.formState.errors.title?.message} /></label>
          <div><label className="editor-field"><FieldLabel required>URL slug</FieldLabel><input aria-required="true" className="admin-control" aria-label="URL slug" readOnly={!slugUnlocked} {...form.register("slug")} /><FieldError message={form.formState.errors.slug?.message} /></label><Button type="button" variant="ghost" onClick={() => { if (slugUnlocked) setText("slug", slugify(values.title)); setSlugUnlocked(!slugUnlocked); }}>{slugUnlocked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{slugUnlocked ? "Use automatic slug" : "Edit slug"}</Button></div>
          <label className="editor-field"><FieldLabel required>Days</FieldLabel><input aria-required="true" className="admin-control" aria-label="Days" type="number" min={1} max={90} {...form.register("days", { onChange: event => { if (!nightsManual) form.setValue("nights", String(Math.max(0, Number(event.target.value) - 1)), { shouldDirty: true }); } })} /><FieldError message={form.formState.errors.days?.message} /></label>
          <div><label className="editor-field"><FieldLabel required>Nights</FieldLabel><input aria-required="true" className="admin-control" aria-label="Nights" type="number" min={0} max={89} {...form.register("nights", { onChange: () => setNightsManual(true) })} /><FieldError message={form.formState.errors.nights?.message} /></label>{nightsManual ? <Button type="button" variant="ghost" onClick={() => { setNightsManual(false); setText("nights", String(Math.max(0, Number(values.days) - 1))); }}>Sync with days</Button> : null}</div>
          {input("startingCity", "Starting city")}
          <label className="editor-field"><FieldLabel required>Currency</FieldLabel><FormSelect aria-required="true" aria-label="Currency" className="admin-control" control={form.control} name={"currency"}>{[...new Set([values.currency, "INR", "USD", "EUR", "GBP", "AED"])].map(currency => <option key={currency}>{currency}</option>)}</FormSelect></label>
        </div>
        <fieldset role="radiogroup" aria-label="Pricing basis" aria-required="true"><legend className="mb-2 text-sm font-bold"><FieldLabel required>Pricing basis</FieldLabel></legend><div className="flex flex-wrap gap-2">{([["PER_PERSON", "Per person"], ["PER_GROUP", "Per group"], ["PER_ROOM", "Per room"], ["ON_REQUEST", "On request"]] as const).map(([basis, label]) => <label key={basis} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${values.priceBasis === basis ? "border-admin-brand bg-admin-brand-soft" : "border-admin-border"}`}><input type="radio" value={basis} {...form.register("priceBasis")} />{label}</label>)}</div></fieldset>
        {values.priceBasis !== "ON_REQUEST" ? input("basePrice", "Base price", "number") : null}
        {textarea("destinationsText", "Destinations", 4000)}
        <p className="m-0 text-xs text-admin-ink-subtle">Type destination names here. Use one name per line for multiple destinations. Your text is saved when you save the package.</p>
        <fieldset className="rounded-xl border border-admin-border p-4" aria-describedby="package-category-help package-category-error">
          <legend className="px-2 text-sm font-bold">Categories</legend>
          <p id="package-category-help" className="mt-0 text-xs text-admin-ink-subtle">Choose one category from the <Link to="/categories" className="font-bold text-admin-brand underline">Categories master</Link>.</p>
          {categories.isPending ? <p role="status" className="text-sm text-admin-ink-subtle">Loading categories…</p> : categories.isError ? <ErrorPanel error={categories.error} retry={() => void categories.refetch()} /> : (
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.data.data.map(item => {
                const selected = values.categoryIds.length === 1 && values.categoryIds[0] === item.id;
                return <label key={item.id} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${selected ? "border-admin-brand bg-admin-brand-soft" : "border-admin-border"} ${item.status === "ARCHIVED" ? "opacity-50" : "cursor-pointer"}`}>
                  <input type="radio" name="package-category" value={item.id} checked={selected} disabled={item.status === "ARCHIVED" || locked} onChange={() => form.setValue("categoryIds", [item.id], { shouldDirty: true, shouldValidate: true })} />
                  <span>{item.name}{" "}<span className="ml-2 text-xs text-admin-ink-subtle">{item.status.toLowerCase()}</span></span>
                </label>;
              })}
              {!categories.data.data.length ? <p className="text-sm text-admin-ink-subtle">No categories yet. Add a category in the Categories master.</p> : null}
            </div>
          )}
          <div id="package-category-error"><FieldError message={form.formState.errors.categoryIds?.message ?? (values.categoryIds.length > 1 ? "This package has multiple categories. Select one category before saving." : undefined)} /></div>
        </fieldset>
      </> : null}
      {tab === "Content" ? <>
        {textarea("overview", "Overview", 30000)}
        <ListEditor label="Highlights" value={values.highlightsText} onChange={value => setText("highlightsText", value)} />
        <div className="editor-grid"><ListEditor required={values.status === "PUBLISHED"} label="Inclusions" value={values.inclusionsText} onChange={value => setText("inclusionsText", value)} presets={["Hotels", "Transfers", "Breakfast", "Permits"]} /><ListEditor required={values.status === "PUBLISHED"} label="Exclusions" value={values.exclusionsText} onChange={value => setText("exclusionsText", value)} presets={["Flights", "Personal expenses", "Insurance"]} negative /></div>
        <details className="rounded-xl border border-admin-border p-4"><summary className="cursor-pointer font-bold">Transport and accommodation</summary><div className="editor-grid mt-4">{textarea("transportInformation", "Transport and pickup information")}{textarea("accommodationNotes", "Accommodation notes")}</div></details>
      </> : null}
      {tab === "Itinerary" ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold"><FieldLabel required={values.status === "PUBLISHED"}>Day-by-day itinerary</FieldLabel></h2><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={values.itinerary.length >= Number(values.days)} onClick={() => { const missing = Math.max(0, Math.min(90, Number(values.days)) - itinerary.fields.length); itinerary.append(Array.from({ length: missing }, (_, i) => emptyDay(itinerary.fields.length + i + 1))); }}>Generate {Math.max(0, Number(values.days) - values.itinerary.length)} missing days</Button><Button type="button" disabled={values.itinerary.length >= 90} onClick={() => itinerary.append(emptyDay(itinerary.fields.length + 1))}>Add day</Button></div></div>
        {itinerary.fields.map((day, i) => <fieldset key={day.id} className="grid gap-4 rounded-xl border border-admin-border p-4"><legend className="px-2 font-bold text-admin-brand">Day {i + 1}</legend>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={i === 0 || busyFiles > 0} onClick={() => itinerary.move(i, i - 1)}>Move up</Button><Button type="button" variant="ghost" disabled={i === itinerary.fields.length - 1 || busyFiles > 0} onClick={() => itinerary.move(i, i + 1)}>Move down</Button><DeleteButton disabled={busyFiles > 0} resource="itinerary day" label="Remove" name={`Day ${i + 1}: ${values.itinerary[i]?.title || "Untitled"}`} description="Remove this day? Save the package to apply the change." onDelete={() => itinerary.remove(i)} /></div>
          <label className="editor-field"><FieldLabel required={values.status === "PUBLISHED"}>Day title</FieldLabel><input aria-required={values.status === "PUBLISHED"} aria-label="Day title" className="admin-control" {...form.register(`itinerary.${i}.title`)} /><FieldError message={form.formState.errors.itinerary?.[i]?.title?.message} /></label>
          <label className="editor-field"><FieldLabel required={values.status === "PUBLISHED"}>Day description</FieldLabel><textarea aria-required={values.status === "PUBLISHED"} aria-label="Day description" className="admin-control" rows={4} {...form.register(`itinerary.${i}.description`)} /><FieldError message={form.formState.errors.itinerary?.[i]?.description?.message} /></label>
          <ListEditor label={`Day ${i + 1} activities`} value={values.itinerary[i]?.activitiesText ?? ""} onChange={value => setText(`itinerary.${i}.activitiesText`, value)} />
          <div><p className="text-sm font-bold">Meals included</p><div className="flex flex-wrap gap-2">{["Breakfast", "Lunch", "Dinner"].map(meal => { const selected = (values.itinerary[i]?.meals ?? "").split(", ").filter(Boolean); return <button key={meal} type="button" aria-pressed={selected.includes(meal)} className={`rounded-full border px-3 py-2 text-sm ${selected.includes(meal) ? "border-admin-brand bg-admin-brand-soft" : "border-admin-border"}`} onClick={() => setText(`itinerary.${i}.meals`, (selected.includes(meal) ? selected.filter(item => item !== meal) : [...selected, meal]).join(", "))}>{meal}</button>; })}</div></div>
          <div className="editor-grid"><label className="editor-field">Meal notes<input className="admin-control" {...form.register(`itinerary.${i}.meals`)} /></label><label className="editor-field">Accommodation<input className="admin-control" {...form.register(`itinerary.${i}.accommodation`)} /></label></div>
          <MediaPicker label={`Day ${i + 1} photo`} ids={values.itinerary[i]?.imageMediaId ? [values.itinerary[i]!.imageMediaId] : []} onChange={assets => setText(`itinerary.${i}.imageMediaId`, assets[0]?.id ?? "")} disabled={save.isPending} onBusyChange={fileBusy} />
        </fieldset>)}
      </> : null}
      {tab === "Departures" ? <>
        <div className="flex flex-wrap gap-2"><Button type="button" variant={!fixedDates ? "primary" : "secondary"} onClick={async () => { if (values.departures.length && !await confirm({ title: "Switch to enquiry-based trips?", message: "This removes the departure dates from this package when saved. Existing enquiries are kept.", confirmText: "Remove departure dates", tone: "warning" })) return; departures.replace([]); setFixedDates(false); }}>Enquiry-based trips</Button><Button type="button" variant={fixedDates ? "primary" : "secondary"} onClick={() => setFixedDates(true)}>Fixed departures</Button></div>
        {!fixedDates ? <p className="text-sm text-admin-ink-muted">Travellers enquire about their preferred dates.</p> : <>
          <Button type="button" onClick={() => departures.append({ startDate: "", endDate: "", pricePerPerson: "", currency: values.currency, status: "SCHEDULED", note: "", seatsAvailable: "" })}>Add departure</Button>
          {departures.fields.map((departure, i) => <fieldset key={departure.id} className="rounded-xl border border-admin-border p-4"><legend className="px-2 font-bold">Departure {i + 1}</legend>
            <div className="mb-3 flex justify-end"><DeleteButton resource="departure" label="Remove" name={values.departures[i]?.startDate || "Unscheduled departure"} description="Remove this departure? Existing enquiries are kept. Save to apply." onDelete={() => departures.remove(i)} /></div>
            <div className="editor-grid">
              <label className="editor-field"><FieldLabel required>Start date</FieldLabel><input aria-required="true" aria-label="Start date" className="admin-control" type="date" {...form.register(`departures.${i}.startDate`, { onChange: event => setText(`departures.${i}.endDate`, endDate(event.target.value, Number(values.days))) })} /><FieldError message={form.formState.errors.departures?.[i]?.startDate?.message} /></label>
              <label className="editor-field"><FieldLabel required>End date</FieldLabel><input aria-required="true" aria-label="End date" className="admin-control" type="date" {...form.register(`departures.${i}.endDate`)} /><FieldError message={form.formState.errors.departures?.[i]?.endDate?.message} /></label>
              <label className="editor-field">Price override (optional)<input className="admin-control" type="number" min={0} {...form.register(`departures.${i}.pricePerPerson`)} /><FieldError message={form.formState.errors.departures?.[i]?.pricePerPerson?.message} /></label>
              <label className="editor-field"><FieldLabel required>Currency</FieldLabel><input aria-required="true" aria-label="Currency" className="admin-control" maxLength={3} {...form.register(`departures.${i}.currency`)} /></label>
              <label className="editor-field"><FieldLabel required>Status</FieldLabel><FormSelect aria-required="true" className="admin-control" aria-label="Status" control={form.control} name={`departures.${i}.status`}><option value="SCHEDULED">Scheduled</option><option value="FILLING_FAST">Filling fast</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></FormSelect></label>
              <label className="editor-field">Seats available (optional)<input className="admin-control" type="number" min={0} {...form.register(`departures.${i}.seatsAvailable`)} /><FieldError message={form.formState.errors.departures?.[i]?.seatsAvailable?.message} /></label>
              <label className="editor-field">Departure note<input className="admin-control" maxLength={500} {...form.register(`departures.${i}.note`)} /></label>
            </div>
          </fieldset>)}
        </>}
      </> : null}
      {tab === "Media" ? <MediaPicker required={values.status === "PUBLISHED"} label="Package gallery" helperText="Choose a cover and order the photos shown on the public package page." ids={values.media.map(item => item.mediaAssetId)} multiple maxFiles={Math.max(10, values.media.length)} allowCoverSelection coverAssetId={coverId} onSetCover={assetId => form.setValue("media", form.getValues("media").map(item => ({ ...item, isCover: item.mediaAssetId === assetId })), { shouldDirty: true })} onChange={assets => { const selectedCover = assets.some(item => item.id === coverId) ? coverId : assets[0]?.id; form.setValue("media", assets.map((asset, sortOrder) => ({ mediaAssetId: asset.id, sortOrder, isCover: asset.id === selectedCover })), { shouldDirty: true }); }} disabled={save.isPending} onBusyChange={fileBusy} /> : null}
      {tab === "Policies" ? <>
        <MediaPicker label="Downloadable brochure" accept="application/pdf" ids={values.brochureMediaId ? [values.brochureMediaId] : []} onChange={assets => setText("brochureMediaId", assets[0]?.id ?? "")} disabled={save.isPending} onBusyChange={fileBusy} />
        <details open className="rounded-xl border border-admin-border p-4"><summary className="cursor-pointer font-bold">Important information</summary><div className="my-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void applyTemplate("importantInformation", "Carry valid government-issued photo identification for all travellers. Confirm the required documents with our team before departure.")}>ID reminder template</Button><Button type="button" variant="secondary" onClick={() => void applyTemplate("importantInformation", "This itinerary includes high-altitude travel. Discuss suitability with your clinician before booking. Allow time to acclimatise and follow your guide’s instructions.")}>High-altitude template</Button></div>{textarea("importantInformation", "Important information text")}</details>
        <details open className="rounded-xl border border-admin-border p-4"><summary className="cursor-pointer font-bold">Cancellation rules</summary><div className="my-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void applyTemplate("cancellationRules", "Cancellation requests must be sent in writing. For requests received at least 15 days before departure: [enter your refund terms]. Within 15 days: [enter your charges]. Supplier charges: [enter details]. Review and complete these terms before publishing.")}>15-day policy template</Button><Button type="button" variant="secondary" onClick={() => void applyTemplate("cancellationRules", "Peak-season bookings may include non-refundable supplier commitments. Non-refundable amount: [enter amount]. Rescheduling terms: [enter terms]. Review and complete these terms before publishing.")}>Peak-season template</Button></div>{textarea("cancellationRules", "Cancellation policy text")}</details>
        <div className="rounded-xl bg-admin-surface-muted p-4"><h3 className="m-0 text-base font-bold">Package FAQs</h3><p className="text-sm">Save this package, then assign its questions in the FAQ manager.</p><Link to="/content/engagement">Open FAQ manager</Link></div>
      </> : null}
      {tab === "Publishing" ? <>
        <div className="rounded-xl border border-admin-border p-4"><h2 className="mt-0 text-lg font-bold">Publishing checklist</h2><ul className="m-0 grid list-none gap-2 p-0">{readiness.map(item => <li key={item.label}><button type="button" onClick={() => setTab(item.tab)} className={`flex items-center gap-2 text-sm ${item.pending ? "text-admin-ink-muted" : item.ready ? "text-admin-positive" : "text-admin-negative"}`}>{item.pending ? <Circle size={16} /> : item.ready ? <Check size={16} /> : <CircleAlert size={16} />}{item.pending ? <span role="status">Checking cover image…</span> : item.label}</button></li>)}</ul>{cover?.visibility === "PRIVATE" ? <p className="mb-0 mt-3 text-sm text-admin-negative">The selected cover is private. Open Media, edit the cover and set Visibility to Public.</p> : null}</div>
        {coverId && coverQuery.isError ? <ErrorPanel error={coverQuery.error} retry={() => void coverQuery.refetch()} /> : null}
        <fieldset role="radiogroup" aria-label="Publication status" aria-required="true"><legend className="mb-2 text-sm font-bold"><FieldLabel required>Publication status</FieldLabel></legend><div className="flex flex-wrap gap-2">{["DRAFT", "PUBLISHED", "ARCHIVED"].map(status => <label className="flex items-center gap-2 rounded-full border border-admin-border px-4 py-2 text-sm" key={status}><input type="radio" value={status} {...form.register("status")} />{status}</label>)}</div></fieldset>
        <div className="editor-grid">{input("publishedAt", "Publish date and time (optional)", "datetime-local")}{input("featuredOrder", "Featured order", "number")}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("isFeatured")} />Feature this package</label>
        <SeoFields titleField={form.register("seoTitle")} descriptionField={form.register("seoDescription")} titleValue={values.seoTitle} descriptionValue={values.seoDescription} fallbackTitle={values.title} fallbackDescription={description} titleError={form.formState.errors.seoTitle?.message} descriptionError={form.formState.errors.seoDescription?.message} />
        <div className="rounded-xl border border-admin-border p-4"><h3 className="mt-0 text-sm font-bold">Search and sharing preview</h3><p className="break-all text-xs text-admin-ink-muted">{publicUrl}</p><p className="mb-1 text-xl text-blue-700">{values.seoTitle || values.title || "Package title"}</p><p className="text-sm text-admin-ink-muted">{values.seoDescription || description || "Your description appears here."}</p>{coverId ? <img className="mt-3 aspect-video w-full max-w-sm rounded-lg object-cover" src={privateMediaUrl(coverId)} alt={cover?.altText ?? "Cover preview"} /> : null}<p className="text-xs text-admin-ink-subtle">Preview only. Search engines and messaging apps may display different text or crops.</p></div>
        {editing && packageQuery.data?.data.status === "PUBLISHED" && publicSiteUrl ? <a href={new URL(`/packages/${encodeURIComponent(packageQuery.data.data.slug)}`, publicSiteUrl).toString()} target="_blank" rel="noreferrer" className="text-sm font-bold text-admin-brand">View public page</a> : null}
      </> : null}
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-admin-border pt-4"><Button type="button" variant="secondary" disabled={index === 0 || busyFiles > 0} onClick={() => void nextTab(tabs[index - 1]!)}>Previous{index > 0 ? `: ${tabs[index - 1]}` : ""}</Button>{index < tabs.length - 1 ? <Button type="button" disabled={locked} onClick={() => void nextTab(tabs[index + 1]!)}>Next: {tabs[index + 1]}</Button> : <Button type="button" disabled={locked} onClick={() => void submit("PUBLISHED")}>Publish package</Button>}</div>
    </Card>
    <StickyActionBar dirty={form.formState.isDirty} saving={save.isPending}>
      {form.formState.isDirty ? <ConfirmButton disabled={locked} dialogTitle="Discard package changes?" dialogDescription="Revert the unsaved changes in this editing session? Uploaded files stay in the library." confirmText="Discard changes" cancelText="Keep editing" tone="warning" onConfirm={() => { form.reset(packageQuery.data ? recordToForm(packageQuery.data.data) : blankForm); setFixedDates(Boolean(packageQuery.data?.data.departures.length)); }}>Discard</ConfirmButton> : null}
      <Button type="button" variant="secondary" disabled={locked} onClick={() => void submit("DRAFT")}>Save as draft</Button><Button type="submit" disabled={locked}>{save.isPending ? "Saving…" : values.status === "PUBLISHED" ? "Publish changes" : "Save changes"}</Button>
    </StickyActionBar>
    {preview ? <aside aria-label="Live package preview" className="fixed bottom-24 right-4 top-24 z-30 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-admin-border bg-admin-surface p-5 shadow-xl"><div className="mb-4 flex items-center justify-between gap-2"><strong>Live package preview</strong><Button type="button" variant="ghost" onClick={() => setPreview(false)}>Close preview</Button></div><div className="grid items-start gap-6"><article className="overflow-hidden rounded-xl border border-admin-border"><div className="relative aspect-[16/10] bg-admin-surface-muted">{coverId ? <img src={privateMediaUrl(coverId)} alt={cover?.altText ?? "Package cover"} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-4xl font-bold">BR</span>}<span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold">{values.nights}N / {values.days}D</span></div><div className="p-4"><h3 className="m-0 font-display text-xl">{values.title || "Package title"}</h3><ul className="pl-5 text-sm">{values.highlightsText.split("\n").filter(Boolean).slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}</ul><p className="border-t border-admin-border pt-3 font-bold">{values.priceBasis === "ON_REQUEST" ? "Price on request" : `${values.currency} ${Number(values.basePrice || 0).toLocaleString("en-IN")}`}</p></div></article><div><h3 className="mt-0 font-display text-2xl">{values.title || "Your journey"}</h3><p className="text-sm">{values.days} days · {values.nights} nights · {values.startingCity || "Starting city"}</p><p className="whitespace-pre-line text-sm text-admin-ink-muted">{values.overview}</p></div></div></aside> : null}
  </form>;
}
