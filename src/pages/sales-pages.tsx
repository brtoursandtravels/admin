import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { AdminSelect } from "../components/AdminSelect";
import { EnquiryContactActions, EnquiryStatusBadge } from "../components/EnquiryTools";
import { FieldLabel } from "../components/FieldLabel";
import { enquiryTransitions, enquiryTypes, enquiryWorkflow, readableLabel, type EnquiryListItem, type EnquiryStatus } from "../lib/sales-workspace";
import { Button, Card, ConfirmButton, ErrorPanel, LoadingPanel, PageHeader, formatDate, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

type EnquiryDetail = EnquiryListItem & {
  subject: string | null; message: string; preferredStartDate: string | null;
  adultCount: number | null; childCount: number | null; partySize: number | null;
  budget: string | null; currency: string; packageSlug: string | null;
  sourcePath: string | null; consentAt: string; policyVersion: string;
  notes: Array<{ id: string; body: string; author: { displayName: string }; createdAt: string }>;
  statusHistory: Array<{ id: string; fromStatus: string | null; toStatus: string; reason: string | null; changedBy: { displayName: string } | null; createdAt: string }>;
};
type Assignee = { id: string; displayName: string };
const statusLabel = (value: string) => enquiryWorkflow[value as EnquiryStatus]?.label ?? readableLabel(value);

export function EnquiryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const returnTo = typeof location.state?.returnTo === "string" && location.state.returnTo.startsWith("/enquiries?") ? location.state.returnTo : "/enquiries";
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["enquiry", id], queryFn: ({ signal }) => apiRequest<DataResponse<EnquiryDetail>>("/admin/inquiries/" + id, { signal }) });
  const assignees = useQuery({ queryKey: ["assignees"], queryFn: ({ signal }) => apiRequest<DataResponse<Assignee[]>>("/admin/assignees", { signal }) });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["enquiry", id] }),
      client.invalidateQueries({ queryKey: ["enquiries"] }),
      client.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
  if (query.isPending) return <LoadingPanel label="Loading enquiry…" />;
  if (!query.data) return <><Link to={returnTo} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-admin-brand"><ArrowLeft size={16} />Back to enquiries</Link><ErrorPanel error={query.error} retry={() => void query.refetch()} /></>;
  return <>
    {query.isError ? <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-admin-border bg-admin-warning-soft p-4 text-sm text-admin-warning"><p className="m-0">The latest details could not load. Your draft is still here. Retry to continue.</p><Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Retry details</Button></div> : null}
    <EnquiryWorkspace key={id} item={query.data.data} assignees={assignees} returnTo={returnTo} refresh={refresh} refreshing={query.isFetching || query.isError} />
  </>;
}

function EnquiryWorkspace({ item, assignees, returnTo, refresh, refreshing }: { item: EnquiryDetail; assignees: UseQueryResult<DataResponse<Assignee[]>>; returnTo: string; refresh: () => Promise<void>; refreshing: boolean }) {
  const { csrfToken, user, publicSiteUrl } = useAuth();
  const { notify } = useToast();
  const [nextStatus, setNextStatus] = useState<EnquiryStatus | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<string | undefined>();
  const allowed = enquiryTransitions[item.status];
  const suggested = item.status === "CONTACTED" && item.type === "CONTACT" ? "CLOSED" : allowed[0];
  const next = nextStatus && allowed.includes(nextStatus) ? nextStatus : suggested;
  const owner = selectedOwner ?? item.assignedTo?.id ?? "";
  const owners = assignees.data?.data ?? [];
  useUnsavedChanges(Boolean(note.trim() || reason.trim() || (selectedOwner !== undefined && selectedOwner !== (item.assignedTo?.id ?? ""))));

  const statusMutation = useMutation({
    mutationFn: (status: EnquiryStatus) => apiRequest("/admin/inquiries/" + item.id + "/status", { method: "PATCH", csrfToken, body: { status, ...(reason.trim() ? { reason: reason.trim() } : {}) } }),
    onSuccess: async () => { setNextStatus(""); setReason(""); notify("Follow-up updated."); await refresh(); },
  });
  const noteMutation = useMutation({
    mutationFn: () => apiRequest("/admin/inquiries/" + item.id + "/notes", { method: "POST", csrfToken, body: { body: note.trim() } }),
    onSuccess: async () => { setNote(""); notify("Private note saved."); await refresh(); },
  });
  const assign = useMutation({
    mutationFn: (assignedToId: string) => apiRequest("/admin/inquiries/" + item.id + "/assignment", { method: "PATCH", csrfToken, body: { assignedToId: assignedToId || null } }),
    onSuccess: async () => { notify("Enquiry owner updated."); await refresh(); setSelectedOwner(undefined); },
  });
  const busy = refreshing || statusMutation.isPending || noteMutation.isPending || assign.isPending;
  const ownerChanged = owner !== (item.assignedTo?.id ?? "");
  const actionLabel = item.status === "LOST" && next === "CONTACTED" ? "Reopen for follow-up" : next ? enquiryWorkflow[next].action : "";
  const partySize = item.partySize ?? ((item.adultCount ?? 0) + (item.childCount ?? 0) || null);
  const details = [
    { label: "Interested in", value: item.packageTitle ?? "General website enquiry" },
    { label: "Preferred travel date", value: item.preferredStartDate ? new Date(item.preferredStartDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "Not provided" },
    { label: "Travellers", value: partySize ? String(partySize) + (item.adultCount !== null ? " · " + item.adultCount + " adults" + (item.childCount ? ", " + item.childCount + " children" : "") : "") : "Not provided" },
    { label: "Budget", value: item.budget ? item.currency + " " + Number(item.budget).toLocaleString("en-IN") : "Not provided" },
  ];

  return <>
    <PageHeader eyebrow={"Enquiry " + item.reference} title={item.requester.name}
      description={(enquiryTypes[item.type as keyof typeof enquiryTypes] ?? readableLabel(item.type)) + " · Received " + formatDate(item.createdAt)}
      actions={<Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-admin-border bg-white px-4 text-sm font-bold text-admin-brand no-underline hover:bg-admin-brand-soft" to={returnTo}><ArrowLeft size={16} aria-hidden="true" />Back to enquiries</Link>} />

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,1fr)]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2>The request</h2><EnquiryStatusBadge status={item.status} /></div>
        <h3 className="mb-2 mt-5 text-sm">{item.subject || "Traveller’s message"}</h3>
        <p className="m-0 whitespace-pre-wrap rounded-xl bg-admin-surface-muted p-4 text-sm leading-7 [overflow-wrap:anywhere]">{item.message || "No message was included."}</p>
        <dl className="mb-0 mt-5 grid gap-x-5 sm:grid-cols-2">{details.map(detail => <div key={detail.label} className="min-w-0 border-t border-admin-border-soft py-3"><dt className="text-xs text-admin-ink-muted">{detail.label}</dt><dd className="mt-1 mb-0 text-sm font-bold leading-6 [overflow-wrap:anywhere]">{detail.value}</dd></div>)}</dl>
        {item.packageSlug && publicSiteUrl ? <a href={new URL("/packages/" + encodeURIComponent(item.packageSlug), publicSiteUrl).toString()} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-admin-brand">View package on website<ArrowUpRight size={14} aria-hidden="true" /></a> : null}
      </Card>

      <aside aria-label="Follow up on this enquiry" className="grid min-w-0 gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-3">
        <Card>
          <h2 className="text-lg!">Contact the traveller</h2>
          <div className="my-4 grid gap-2 text-sm">
            {item.requester.phone ? <a href={"tel:" + item.requester.phone} className="font-bold text-admin-brand">{item.requester.phone}</a> : <p className="m-0 text-xs text-admin-ink-muted">No phone number provided. Please use email.</p>}
            <a href={"mailto:" + item.requester.email} className="text-admin-brand [overflow-wrap:anywhere]">{item.requester.email}</a>
          </div>
          <EnquiryContactActions email={item.requester.email} phone={item.requester.phone} />
          <p className="mb-0 mt-3 text-xs leading-5 text-admin-ink-muted">These buttons open your contact apps. After the conversation, record the outcome below.</p>
          <div className="mt-5 border-t border-admin-border-soft pt-5">
            <h3 className="m-0 flex items-center gap-2 text-base"><CheckCheck size={18} aria-hidden="true" />Save the next step</h3>
            <p className="mt-2 mb-4 text-xs leading-5 text-admin-ink-muted">{enquiryWorkflow[item.status].hint}</p>
            {allowed.length && next ? <div className="admin-form">
              <label><FieldLabel required>Outcome</FieldLabel><AdminSelect aria-label="Outcome" aria-required="true" value={next} disabled={busy} onValueChange={value => { setNextStatus(value as EnquiryStatus); statusMutation.reset(); }}>{allowed.map(status => <option value={status} key={status}>{status === "CONTACTED" && item.status === "LOST" ? "Reopen conversation" : enquiryWorkflow[status].label}</option>)}</AdminSelect></label>
              <label><span>Follow-up note <span className="ml-1 text-xs font-normal text-admin-ink-muted">Optional</span></span><textarea aria-label="Follow-up note" rows={3} maxLength={500} disabled={busy} placeholder="For example, shared the itinerary; traveller will confirm tomorrow." value={reason} onChange={event => setReason(event.target.value)} /></label>
              {statusMutation.isError ? <p role="alert" className="m-0 text-sm text-admin-negative">{getErrorMessage(statusMutation.error)}</p> : null}
              {next === "LOST" || next === "CLOSED" ? <ConfirmButton type="button" disabled={busy} dialogTitle={next === "CLOSED" ? "Close this enquiry?" : "Mark as not proceeding?"}
                dialogDescription={next === "CLOSED" ? "Use this when the request is fully handled. The enquiry and its notes stay available, but it cannot be reopened." : "Use this when the traveller does not want to continue. You can reopen the conversation later."}
                detailText={item.reference + " · " + item.requester.name} confirmText={actionLabel} tone={next === "LOST" ? "danger" : "warning"} onConfirm={() => statusMutation.mutateAsync(next)}>{actionLabel}</ConfirmButton> :
                <Button type="button" disabled={busy} onClick={() => statusMutation.mutate(next)}><Check size={16} aria-hidden="true" />{statusMutation.isPending ? "Saving…" : actionLabel}</Button>}
              <p className="m-0 text-xs leading-5 text-admin-ink-subtle">This saves an internal update. It does not send a message to the traveller.</p>
            </div> : <p className="mb-0 rounded-xl bg-admin-positive-soft p-3 text-sm text-admin-positive">No further action is needed. You can still add private notes below.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 text-base!"><UserRound size={18} aria-hidden="true" />Who is following up?</h2>
          {assignees.isError ? <div role="alert" className="mt-3 text-sm text-admin-negative"><p>Staff names could not load.</p><Button type="button" variant="secondary" onClick={() => void assignees.refetch()}>Retry staff list</Button></div> :
            <div className="admin-form mt-3"><label>Enquiry owner<AdminSelect aria-label="Enquiry owner" value={owner} disabled={busy || assignees.isPending} onValueChange={value => { setSelectedOwner(value); assign.reset(); }}><option value="">No owner assigned</option>{item.assignedTo && !owners.some(owner => owner.id === item.assignedTo?.id) ? <option value={item.assignedTo.id} disabled>{item.assignedTo.displayName}</option> : null}{owners.map(owner => <option value={owner.id} key={owner.id}>{owner.displayName}</option>)}</AdminSelect></label>
              <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy || !ownerChanged || assignees.isPending} onClick={() => assign.mutate(owner)}>{assign.isPending ? "Saving…" : "Save owner"}</Button>{user && owners.some(owner => owner.id === user.id) && item.assignedTo?.id !== user.id ? <Button type="button" variant="ghost" disabled={busy} onClick={() => assign.mutate(user.id)}>Assign to me</Button> : null}</div>
              {assign.isError ? <p role="alert" className="m-0 text-sm text-admin-negative">{getErrorMessage(assign.error)}</p> : null}
            </div>}
        </Card>
      </aside>

      <Card className="lg:col-start-1">
        <h2>Private staff notes</h2><p className="mb-4 mt-2 text-sm leading-6 text-admin-ink-muted">Keep call details, preferences and reminders here. Travellers cannot see these notes.</p>
        <form className="admin-form" onSubmit={event => { event.preventDefault(); if (note.trim()) noteMutation.mutate(); }}>
          <label><FieldLabel required>Add note</FieldLabel><textarea aria-label="Add note" aria-required="true" rows={3} maxLength={5000} disabled={busy} placeholder="What should the next team member know?" value={note} onChange={event => setNote(event.target.value)} /></label>
          {noteMutation.isError ? <p role="alert" className="m-0 text-sm text-admin-negative">{getErrorMessage(noteMutation.error)}</p> : null}
          <Button className="justify-self-start" type="submit" disabled={busy || !note.trim()}>{noteMutation.isPending ? "Saving…" : "Save private note"}</Button>
        </form>
        <div className="mt-5 grid gap-4" aria-label="Saved staff notes">{item.notes.length ? item.notes.slice().reverse().map(record => <article className="rounded-xl border border-admin-border-soft p-4" key={record.id}><p className="m-0 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{record.body}</p><p className="mt-2 mb-0 text-xs text-admin-ink-subtle">{record.author.displayName} · {formatDate(record.createdAt)}</p></article>) : <p className="m-0 text-xs text-admin-ink-muted">No notes saved yet.</p>}</div>
      </Card>

      <Card className="lg:col-start-1">
        <details className="group"><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-bold text-admin-brand"><Clock3 size={17} aria-hidden="true" />Follow-up history<span className="ml-auto text-xs font-normal text-admin-ink-muted">{item.statusHistory.length} {item.statusHistory.length === 1 ? "update" : "updates"}</span><ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180" /></summary>
          <ol className="mb-0 mt-4 grid list-none gap-4 border-l border-admin-border pl-4">{item.statusHistory.map(record => <li key={record.id}><p className="m-0 text-sm font-bold">{record.fromStatus ? statusLabel(record.fromStatus) + " → " : ""}{statusLabel(record.toStatus)}</p>{record.reason ? <p className="mt-1 mb-0 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{record.reason}</p> : null}<p className="mt-1 mb-0 text-xs text-admin-ink-subtle">{record.changedBy?.displayName ?? "Website"} · {formatDate(record.createdAt)}</p></li>)}</ol>
          {!item.statusHistory.length ? <p className="mb-0 mt-3 text-sm text-admin-ink-muted">No status changes yet.</p> : null}
        </details>
        <details className="mt-4 border-t border-admin-border-soft pt-4"><summary className="cursor-pointer text-xs font-bold text-admin-ink-muted">Request information</summary><p className="mb-0 mt-3 text-xs leading-6 text-admin-ink-muted [overflow-wrap:anywhere]">Reference: {item.reference}<br />Received: {formatDate(item.createdAt)}<br />Privacy accepted: {formatDate(item.consentAt)} · {item.policyVersion}<br />Source: {item.sourcePath ?? "Website"}</p></details>
      </Card>
    </div>
  </>;
}
