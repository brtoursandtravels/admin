import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, downloadProtected, type PageResponse } from "../api";
import { AdminSelect } from "../components/AdminSelect";
import { EnquiryStatusBadge } from "../components/EnquiryTools";
import { InboxDate, InboxRefresh, InboxSearch, InboxStatusFilters } from "../components/InboxTools";
import { enquiryStatuses, enquiryTypes, enquiryWorkflow, listPage, readableLabel, type EnquiryListItem } from "../lib/sales-workspace";
import { ActionLink, Button, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader, Pagination, getErrorMessage, useToast } from "../ui";

const statusLabels = Object.fromEntries(enquiryStatuses.map(status => [status, enquiryWorkflow[status].label]));

export default function EnquiriesPage() {
  const [params, setParams] = useSearchParams();
  const { notify } = useToast();
  const { page, pageSize } = listPage(params);
  const q = params.get("q") ?? "";
  const status = enquiryStatuses.find(value => value === params.get("status")) ?? "";
  const type = Object.hasOwn(enquiryTypes, params.get("type") ?? "") ? params.get("type")! : "";
  const packageFilter = params.get("package") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const filters = { q, status, type, package: packageFilter, from, to };
  const search = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  search.set("page", String(page)); search.set("pageSize", String(pageSize));
  const queryString = search.toString();
  const filtered = Object.values(filters).some(Boolean);
  const query = useQuery({ queryKey: ["enquiries", queryString], queryFn: ({ signal }) => apiRequest<PageResponse<EnquiryListItem>>("/admin/inquiries?" + queryString, { signal }), placeholderData: keepPreviousData });
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    if (!("page" in values)) next.set("page", "1");
    setParams(next, { flushSync: true });
  }
  const clear = () => setParams({ pageSize: String(pageSize) }, { flushSync: true });
  const download = useMutation({ mutationFn: (filters: string) => downloadProtected("/admin/inquiries/export.csv?" + filters, "br-enquiries.csv"), onError: error => notify(getErrorMessage(error), "error") });
  const returnState = { returnTo: "/enquiries?" + params.toString() };
  const filterChips = [
    { key: "q", label: "Search", value: q },
    { key: "type", label: "Type", value: enquiryTypes[type as keyof typeof enquiryTypes] ?? "" },
    { key: "package", label: "Package", value: packageFilter },
    { key: "from", label: "From", value: from },
    { key: "to", label: "Until", value: to },
  ].filter(item => item.value);

  return <>
    <PageHeader eyebrow="Traveller requests" title="Enquiries"
      description="Start with Needs reply. Open a request, contact the traveller, then save the next step."
      actions={<div className="flex flex-wrap gap-2"><InboxRefresh busy={query.isFetching} onRefresh={() => void query.refetch()} /><Button variant="secondary" disabled={download.isPending || query.isFetching || !query.data?.meta.total} onClick={() => download.mutate(queryString)} title="Download enquiries matching the current filters"><Download size={16} aria-hidden="true" />{download.isPending ? "Exporting…" : "Export CSV"}</Button></div>} />

    <section aria-label="Filter enquiries" className="mb-5 rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-admin-card sm:p-5">
      <InboxStatusFilters label="Enquiry status" statuses={enquiryStatuses} labels={statusLabels} value={status} onChange={status => update({ status })} />
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-admin-border-soft pt-4">
        <InboxSearch key={q} initialValue={q} label="Search enquiries" placeholder="Name, phone, email, package or reference" onSearch={q => update({ q })} />
      </div>
      <EnquiryMoreFilters key={[type, packageFilter, from, to].join("|")} type={type} packageFilter={packageFilter} from={from} to={to} onApply={update} />
      {filtered ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-admin-border-soft pt-3" aria-label="Applied filters">
        {filterChips.map(item => <button type="button" key={item.key} aria-label={"Remove " + item.label.toLowerCase() + " filter"} className="inline-flex max-w-full items-center gap-2 rounded-full bg-admin-brand-soft px-3 py-1.5 text-xs font-bold text-admin-brand" onClick={() => update({ [item.key]: "" })}><span className="truncate">{item.label}: {item.value}</span><X size={13} aria-hidden="true" className="shrink-0" /></button>)}
        <button type="button" className="min-h-9 px-2 text-xs font-bold text-admin-brand underline underline-offset-4" onClick={clear}>Clear filters</button>
      </div> : null}
    </section>

    <Card className="overflow-hidden p-0!">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-admin-border-soft px-5 py-4">
        <div><h2 className="text-base!">{status ? enquiryWorkflow[status].label : "All enquiries"}</h2><p className="mt-1 mb-0 text-xs leading-5 text-admin-ink-muted">{status ? enquiryWorkflow[status].hint : "Latest requests first. Use Needs reply to find people waiting to hear from you."}</p></div>
        <p className="m-0 shrink-0 rounded-full bg-admin-surface-muted px-3 py-1.5 text-xs font-bold text-admin-ink-muted" aria-live="polite">{query.isFetching ? "Updating…" : query.data ? query.data.meta.total + (query.data.meta.total === 1 ? " enquiry" : " enquiries") : ""}</p>
      </div>
      {query.isPending ? <LoadingPanel label="Loading enquiries…" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : <>
        {!query.data.data.length ? <EmptyState title={query.data.meta.total > 0 ? "No enquiries on this page" : filtered ? "No matching enquiries" : "Your enquiry inbox is ready"}
          description={filtered ? "Try another search or clear the filters to see more requests." : "Website contact forms and package requests appear here. Open a request to reply and record your follow-up."}
          action={page > 1 ? <Button variant="secondary" onClick={() => update({ page: "1" })}>Back to first page</Button> : filtered ? <Button variant="secondary" onClick={clear}>Show all enquiries</Button> : undefined} /> : <>
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto] gap-5 bg-admin-surface-muted px-6 py-3 text-xs font-bold text-admin-ink-muted lg:grid"><span>Traveller</span><span>Request</span><span>Follow-up</span><span className="w-28">Action</span></div>
          <ul aria-label="Enquiries" aria-busy={query.isFetching} className={"m-0 list-none divide-y divide-admin-border-soft p-0 " + (query.isPlaceholderData ? "opacity-60" : "")}>
            {query.data.data.map(item => <li key={item.id} className={"grid min-w-0 gap-4 border-l-[3px] px-4 py-5 transition-colors hover:bg-admin-surface-muted/40 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:gap-5 " + (item.status === "NEW" ? "border-l-admin-accent" : "border-l-transparent")}>
              <div className="min-w-0">
                <Link to={"/enquiries/" + item.id} state={returnState} className="text-sm font-black text-admin-brand-deep no-underline [overflow-wrap:anywhere] hover:underline">{item.requester.name}</Link>
                {item.requester.phone ? <a href={"tel:" + item.requester.phone} className="mt-2 block w-fit text-sm text-admin-brand no-underline hover:underline">{item.requester.phone}</a> : <p className="mt-2 mb-0 text-xs text-admin-ink-subtle">Email contact only</p>}
                <a href={"mailto:" + item.requester.email} className="mt-1.5 block text-xs text-admin-ink-muted no-underline [overflow-wrap:anywhere] hover:underline">{item.requester.email}</a>
              </div>
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold leading-5 text-admin-brand-deep [overflow-wrap:anywhere]">{item.packageTitle ?? "Website message"}</p>
                <p className="mt-1 mb-2 text-xs text-admin-ink-muted">{enquiryTypes[item.type as keyof typeof enquiryTypes] ?? readableLabel(item.type)} · <Link className="text-admin-brand underline-offset-2 hover:underline" to={"/enquiries/" + item.id} state={returnState}>{item.reference}</Link></p>
                <InboxDate value={item.createdAt} />
              </div>
              <div className="min-w-0"><EnquiryStatusBadge status={item.status} /><p className="mt-2 mb-0 text-xs leading-5 text-admin-ink-muted">{enquiryWorkflow[item.status].hint}</p><p className="mt-1.5 mb-0 text-xs text-admin-ink-subtle">{item.assignedTo ? "Owner: " + item.assignedTo.displayName : "No owner assigned"}</p></div>
              <ActionLink className="self-start justify-self-start px-3! text-xs!" to={"/enquiries/" + item.id} state={returnState} aria-label={"View enquiry " + item.reference}>Open enquiry<ArrowRight size={14} aria-hidden="true" /></ActionLink>
            </li>)}
          </ul>
        </>}
        <Pagination meta={query.data.meta} onPage={page => update({ page: String(page) })} onPageSize={pageSize => update({ pageSize: String(pageSize) })} />
      </>}
    </Card>
    <p className="mt-4 text-xs leading-5 text-admin-ink-muted">Calling or messaging opens your phone, email or WhatsApp app. Record the outcome inside the enquiry. CSV exports include up to 10,000 matching requests.</p>
  </>;
}

function EnquiryMoreFilters({ type, packageFilter, from, to, onApply }: { type: string; packageFilter: string; from: string; to: string; onApply: (values: Record<string, string>) => void }) {
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState(type);
  const applied = Boolean(type || packageFilter || from || to);
  return <details open={applied || undefined} className="mt-3">
    <summary className="flex w-fit cursor-pointer items-center gap-2 py-1 text-xs font-bold text-admin-brand"><SlidersHorizontal size={15} aria-hidden="true" />More filters{applied ? " · applied" : ""}</summary>
    <form noValidate className="mt-3 grid min-w-0 gap-3 rounded-xl bg-admin-surface-muted p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const values = { type: selectedType, package: String(data.get("package") ?? "").trim(), from: String(data.get("from") ?? ""), to: String(data.get("to") ?? "") };
      if (values.from && values.to && values.from > values.to) { setError("Choose an end date on or after the start date."); return; }
      setError(""); onApply(values);
    }}>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Enquiry type<AdminSelect aria-label="Enquiry type" value={selectedType} onValueChange={setSelectedType}><option value="">All types</option>{Object.entries(enquiryTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AdminSelect></label>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Package<input name="package" className="admin-control" defaultValue={packageFilter} placeholder="Package name" maxLength={180} /></label>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Received from (IST)<input name="from" className="admin-control" type="date" defaultValue={from} /></label>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Received until (IST)<input name="to" className="admin-control" type="date" defaultValue={to} /></label>
      {error ? <p role="alert" className="m-0 text-xs text-admin-negative sm:col-span-2 xl:col-span-4">{error}</p> : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4"><Button type="submit" variant="secondary">Apply filters</Button>{applied ? <Button type="button" variant="ghost" onClick={() => onApply({ type: "", package: "", from: "", to: "" })}>Reset extra filters</Button> : null}</div>
    </form>
  </details>;
}
