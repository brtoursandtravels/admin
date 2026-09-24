import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Download, Mail, Phone, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, downloadProtected, type PageResponse } from "../api";
import { AdminSelect } from "../components/AdminSelect";
import { InboxDate, InboxRefresh, InboxSearch, InboxStatusFilters } from "../components/InboxTools";
import { enquiryStatuses, enquiryTypes, listPage, readableLabel, type EnquiryListItem } from "../lib/sales-workspace";
import { ActionLink, Button, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader, Pagination, StatusBadge, getErrorMessage, useToast } from "../ui";

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
  const query = useQuery({ queryKey: ["enquiries", queryString], queryFn: ({ signal }) => apiRequest<PageResponse<EnquiryListItem>>(`/admin/inquiries?${queryString}`, { signal }), placeholderData: keepPreviousData });
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    if (!("page" in values)) next.set("page", "1");
    setParams(next, { flushSync: true });
  }
  const clear = () => setParams({ pageSize: String(pageSize) }, { flushSync: true });
  const download = useMutation({ mutationFn: (filters: string) => downloadProtected(`/admin/inquiries/export.csv?${filters}`, "br-enquiries.csv"), onError: error => notify(getErrorMessage(error), "error") });
  return <>
    <PageHeader eyebrow="Sales workspace" title="Enquiries" description="Follow up with travellers, review their plans and keep each enquiry moving." actions={<div className="flex flex-wrap gap-2"><InboxRefresh busy={query.isFetching} onRefresh={() => void query.refetch()} /><Button variant="secondary" disabled={download.isPending || query.isFetching || !query.data?.meta.total} onClick={() => download.mutate(queryString)} title="Download up to 10,000 enquiries matching your filters"><Download size={16} aria-hidden="true" />{download.isPending ? "Exporting..." : "Export CSV"}</Button></div>} />
    <section aria-label="Filter enquiries" className="mb-5 rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-admin-card">
      <div className="flex flex-wrap items-end gap-4"><InboxSearch key={q} initialValue={q} label="Search enquiries" placeholder="Reference, name, email or phone" onSearch={q => update({ q })} /><label className="grid min-w-0 flex-1 basis-48 gap-2 text-sm font-bold sm:max-w-64">Enquiry type<AdminSelect aria-label="Enquiry type" value={type} onValueChange={type => update({ type })}><option value="">All enquiry types</option>{Object.entries(enquiryTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AdminSelect></label></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-admin-border-soft pt-4"><InboxStatusFilters label="Enquiry status" statuses={enquiryStatuses} value={status} onChange={status => update({ status })} />{filtered ? <button type="button" className="text-xs font-bold text-admin-brand underline underline-offset-4" onClick={clear}>Clear filters</button> : null}</div>
      <EnquiryMoreFilters key={`${packageFilter}|${from}|${to}`} packageFilter={packageFilter} from={from} to={to} onApply={update} />
    </section>
    <Card className="overflow-hidden p-0!">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border-soft px-5 py-4"><h2 className="text-base!">{status ? `${readableLabel(status)} enquiries` : "All enquiries"}</h2><p className="m-0 text-xs text-admin-ink-muted" aria-live="polite">{query.isFetching ? "Updating results..." : query.data ? `${query.data.meta.total} ${query.data.meta.total === 1 ? "enquiry" : "enquiries"}${filtered ? " found" : " total"}` : ""}</p></div>
      {query.isPending ? <LoadingPanel label="Loading enquiries..." /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : <>
        {!query.data.data.length ? <EmptyState title={query.data.meta.total > 0 ? "No enquiries on this page" : filtered ? "No matching enquiries" : "No enquiries yet"} description={filtered ? "Try another search, date range or status." : "New requests from the website will appear here, ready for your team to follow up."} action={page > 1 ? <Button variant="secondary" onClick={() => update({ page: "1" })}>Back to first page</Button> : filtered ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} /> : <>
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,.8fr)_8rem_7.5rem] gap-5 bg-admin-surface-muted px-5 py-3 text-[0.65rem] font-bold uppercase tracking-wide text-admin-ink-muted xl:grid"><span>Traveller</span><span>Enquiry</span><span>Status / assigned to</span><span>Received</span><span>Action</span></div>
          <ul aria-label="Enquiries" aria-busy={query.isFetching} className={`m-0 list-none divide-y divide-admin-border-soft p-0 ${query.isPlaceholderData ? "opacity-60" : ""}`}>{query.data.data.map(item => <li key={item.id} className="grid min-w-0 gap-4 px-5 py-5 transition-colors hover:bg-admin-surface-muted/40 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,.8fr)_8rem_7.5rem] xl:gap-5">
            <div className="min-w-0"><p className="m-0 font-bold text-admin-brand-deep [overflow-wrap:anywhere]">{item.requester.name}</p><a href={`mailto:${item.requester.email}`} className="mt-2 flex min-w-0 items-start gap-2 text-xs text-admin-ink-muted no-underline hover:text-admin-brand"><Mail size={14} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{item.requester.email}</span></a>{item.requester.phone ? <a href={`tel:${item.requester.phone}`} className="mt-2 inline-flex items-center gap-2 text-xs text-admin-ink-muted no-underline hover:text-admin-brand"><Phone size={14} aria-hidden="true" />{item.requester.phone}</a> : null}</div>
            <div className="min-w-0"><Link className="text-sm font-bold text-admin-brand no-underline hover:underline" to={`/enquiries/${item.id}`} state={{ returnTo: `/enquiries?${params.toString()}` }}>{item.reference}</Link><p className="mt-1.5 mb-0 text-sm leading-5 [overflow-wrap:anywhere]">{item.packageTitle ?? "General travel request"}</p><p className="mt-1 mb-0 text-xs text-admin-ink-muted">{enquiryTypes[item.type as keyof typeof enquiryTypes] ?? readableLabel(item.type)}</p></div>
            <div><StatusBadge value={item.status} /><p className={`mt-2 mb-0 text-xs ${item.assignedTo ? "text-admin-ink-muted" : "font-bold text-admin-warning"}`}>{item.assignedTo?.displayName ?? "Not assigned"}</p></div>
            <div><span className="mb-1 block text-xs font-bold text-admin-ink-muted xl:hidden">Received</span><InboxDate value={item.createdAt} /></div>
            <ActionLink className="self-start px-3! text-xs! sm:justify-self-start" variant="secondary" to={`/enquiries/${item.id}`} state={{ returnTo: `/enquiries?${params.toString()}` }} aria-label={`View enquiry ${item.reference}`}>View details<ArrowUpRight size={14} aria-hidden="true" /></ActionLink>
          </li>)}</ul>
        </>}
        <Pagination meta={query.data.meta} onPage={page => update({ page: String(page) })} onPageSize={pageSize => update({ pageSize: String(pageSize) })} />
      </>}
    </Card>
    <p className="mt-4 text-xs text-admin-ink-muted">Enquiries are requests for follow-up. CSV exports use your current filters and include up to 10,000 enquiries.</p>
  </>;
}

function EnquiryMoreFilters({ packageFilter, from, to, onApply }: { packageFilter: string; from: string; to: string; onApply: (values: Record<string, string>) => void }) {
  const [error, setError] = useState("");
  return <details open={Boolean(packageFilter || from || to) || undefined} className="mt-4 border-t border-admin-border-soft pt-3">
    <summary className="flex w-fit cursor-pointer items-center gap-2 text-xs font-bold text-admin-brand"><SlidersHorizontal size={15} aria-hidden="true" />Package & date filters{packageFilter || from || to ? " (applied)" : ""}</summary>
    <form noValidate className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] xl:items-end" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const values = { package: String(data.get("package") ?? "").trim(), from: String(data.get("from") ?? ""), to: String(data.get("to") ?? "") };
      if (values.from && values.to && values.from > values.to) { setError("Choose an end date on or after the start date."); return; }
      setError(""); onApply(values);
    }}>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Package<input name="package" className="admin-control" defaultValue={packageFilter} placeholder="Package title or URL name" maxLength={180} /></label>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Received from (IST)<input name="from" className="admin-control" type="date" defaultValue={from} /></label>
      <label className="grid min-w-0 gap-2 text-xs font-bold">Received until (IST)<input name="to" className="admin-control" type="date" defaultValue={to} /></label>
      <Button type="submit" variant="secondary">Apply filters</Button>
      {error ? <p role="alert" className="m-0 text-xs text-admin-negative sm:col-span-2 xl:col-span-4">{error}</p> : null}
    </form>
  </details>;
}
