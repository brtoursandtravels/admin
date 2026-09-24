import { AdminSelect } from "../components/AdminSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  apiRequest,
  type DataResponse,
} from "../api";
import { useAuth } from "../auth";
import type { Role } from "../types";
import { enquiryTypes, readableLabel, type EnquiryListItem } from "../lib/sales-workspace";
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  formatDate,
  getErrorMessage,
  useToast,
} from "../ui";

type EnquiryStatus = EnquiryListItem["status"];
type EnquiryDetail = EnquiryListItem & {
  subject: string | null;
  message: string;
  preferredStartDate: string | null;
  adultCount: number | null;
  childCount: number | null;
  partySize: number | null;
  budget: string | null;
  currency: string;
  packageSlug: string | null;
  departureId: string | null;
  sourcePath: string | null;
  consentAt: string;
  policyVersion: string;
  notes: Array<{
    id: string;
    body: string;
    author: { displayName: string };
    createdAt: string;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedBy: { displayName: string } | null;
    createdAt: string;
  }>;
};
type Assignee = { id: string; displayName: string; role: Role };
const transitions: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUOTED", "CLOSED", "LOST"],
  QUOTED: ["CONFIRMED", "CLOSED", "LOST"],
  CONFIRMED: ["CLOSED", "LOST"],
  CLOSED: [],
  LOST: ["CONTACTED"],
};
const workflowStages: EnquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "CONFIRMED",
  "CLOSED",
];

export function EnquiryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const returnTo = typeof location.state?.returnTo === "string" && location.state.returnTo.startsWith("/enquiries?") ? location.state.returnTo : "/enquiries";
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const query = useQuery({
    queryKey: ["enquiry", id],
    queryFn: () =>
      apiRequest<DataResponse<EnquiryDetail>>(`/admin/inquiries/${id}`),
  });
  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: () => apiRequest<DataResponse<Assignee[]>>("/admin/assignees"),
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["enquiry", id] });
    await client.invalidateQueries({ queryKey: ["enquiries"] });
    await client.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const statusMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/inquiries/${id}/status`, {
        method: "PATCH",
        csrfToken,
        body: { status: nextStatus, reason: reason || undefined },
      }),
    onSuccess: async () => {
      notify("Enquiry status updated.");
      setNextStatus("");
      setReason("");
      await refresh();
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const noteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/inquiries/${id}/notes`, {
        method: "POST",
        csrfToken,
        body: { body: note },
      }),
    onSuccess: async () => {
      notify("Private note added.");
      setNote("");
      await refresh();
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const assign = useMutation({
    mutationFn: (assignedToId: string) =>
      apiRequest(`/admin/inquiries/${id}/assignment`, {
        method: "PATCH",
        csrfToken,
        body: { assignedToId: assignedToId || null },
      }),
    onSuccess: async () => {
      notify("Assignment updated.");
      await refresh();
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  if (query.isPending) return <LoadingPanel label="Loading private enquiry…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data.data;
  return (
    <>
      <PageHeader
        eyebrow="Enquiry detail"
        title={item.reference}
        description={`${enquiryTypes[item.type as keyof typeof enquiryTypes] ?? readableLabel(item.type)} received ${formatDate(item.createdAt)}`}
        actions={
          <Link className="inline-flex min-h-[2.6rem] items-center justify-center gap-2 rounded-[0.6rem] border border-transparent px-4 py-2.5 font-bold no-underline transition duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 border-admin-border bg-admin-surface text-admin-brand hover:not-disabled:bg-admin-brand-soft" to={returnTo}>
            Back to enquiries
          </Link>
        }
      />
      <div className="mb-4 overflow-x-auto rounded-2xl border border-admin-border bg-admin-surface p-3 shadow-admin-card" aria-label="Enquiry workflow">
        <div className="flex min-w-[42rem] items-center">
          {workflowStages.map((stage, index) => {
            const currentIndex = workflowStages.indexOf(item.status);
            const active = item.status !== "LOST" && index <= currentIndex;
            const current = stage === item.status;
            return (
              <div className="flex flex-1 items-center last:flex-none" key={stage}>
                <span className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[0.68rem] font-black uppercase tracking-[0.05em] ${current ? "border-admin-brand bg-admin-brand text-white" : active ? "border-admin-positive/20 bg-admin-positive-soft text-admin-positive" : "border-admin-border bg-admin-surface-muted text-admin-ink-subtle"}`}>
                  {stage.replaceAll("_", " ")}
                </span>
                {index < workflowStages.length - 1 ? <span className={`mx-2 h-px flex-1 ${active && index < currentIndex ? "bg-admin-positive" : "bg-admin-border"}`} /> : null}
              </div>
            );
          })}
          {item.status === "LOST" ? <span className="ml-3 inline-flex min-h-9 items-center rounded-full bg-admin-negative-soft px-3 text-[0.68rem] font-black uppercase text-admin-negative">Lost</span> : null}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <div className="grid gap-4">
          <Card>
            <div className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start [&_p]:mb-0 [&_p]:text-admin-ink-muted">
              <div>
                <StatusBadge value={item.status} />
                <h2>{item.requester.name}</h2>
              </div>
              <label>
                Assigned to
                <AdminSelect
                  value={item.assignedTo?.id ?? ""}
                  onValueChange={(selectedValue) => assign.mutate(selectedValue)}
                >
                  <option value="">Unassigned</option>
                  {assignees.data?.data.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} · {user.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </AdminSelect>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-admin-border-soft pt-4">
              <a className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-admin-brand px-3.5 text-[0.78rem] font-black text-white no-underline hover:bg-admin-brand-deep" href={`mailto:${item.requester.email}`}><Mail size={16} />Email requester</a>
              {item.requester.phone ? <>
                <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-admin-border bg-white px-3.5 text-[0.78rem] font-black text-admin-brand no-underline hover:bg-admin-brand-soft" href={`tel:${item.requester.phone}`}><Phone size={16} />Call</a>
                <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-admin-positive/20 bg-admin-positive-soft px-3.5 text-[0.78rem] font-black text-admin-positive no-underline hover:brightness-95" href={`https://wa.me/${item.requester.phone.replace(/\D/g, "")}`} rel="noreferrer" target="_blank"><MessageCircle size={16} />WhatsApp</a>
              </> : null}
            </div>
            <dl className="my-4 grid grid-cols-2 max-[680px]:grid-cols-1 [&_div]:border-t [&_div]:border-admin-border-soft [&_div]:py-3 [&_dt]:text-[0.65rem] [&_dt]:uppercase [&_dt]:text-admin-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:break-words">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${item.requester.email}`}>
                    {item.requester.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  {item.requester.phone ? (
                    <a href={`tel:${item.requester.phone}`}>
                      {item.requester.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Package</dt>
                <dd>{item.packageTitle ?? "General enquiry"}</dd>
              </div>
              <div>
                <dt>Preferred date</dt>
                <dd>{item.preferredStartDate ?? "—"}</dd>
              </div>
              <div>
                <dt>Travellers</dt>
                <dd>{item.partySize ?? "—"}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>
                  {item.budget
                    ? `${item.currency} ${Number(item.budget).toLocaleString("en-IN")}`
                    : "—"}
                </dd>
              </div>
            </dl>
            <h3>{item.subject || "Visitor message"}</h3>
            <p className="whitespace-pre-wrap rounded-[0.65rem] bg-admin-surface-muted p-4 leading-relaxed">{item.message}</p>
            <p className="text-[0.7rem] text-admin-ink-subtle">
              Privacy accepted {formatDate(item.consentAt)} · policy{" "}
              {item.policyVersion} · source {item.sourcePath ?? "unknown"}
            </p>
          </Card>
          <Card>
            <h2>Private staff notes</h2>
            {item.notes.length ? (
              <div className="my-4 ml-1.5 grid gap-4 border-l-2 border-admin-border pl-4 [&_article]:relative [&_article]:before:absolute [&_article]:before:top-1 [&_article]:before:-left-[1.35rem] [&_article]:before:h-2 [&_article]:before:w-2 [&_article]:before:rounded-full [&_article]:before:bg-admin-accent [&_article]:before:content-[''] [&_span]:text-[0.67rem] [&_span]:text-admin-ink-muted [&_p]:mt-1 [&_p]:mb-0">
                {item.notes.map((record) => (
                  <article key={record.id}>
                    <span>
                      {record.author.displayName} ·{" "}
                      {formatDate(record.createdAt)}
                    </span>
                    <p>{record.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No notes"
                description="Add the first private follow-up note."
              />
            )}
            <label>
              Add note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <Button
              disabled={noteMutation.isPending || !note.trim()}
              onClick={() => noteMutation.mutate()}
            >
              Add private note
            </Button>
          </Card>
          <Card>
            <h2>Status history</h2>
            <div className="my-4 ml-1.5 grid gap-4 border-l-2 border-admin-border pl-4 [&_article]:relative [&_article]:before:absolute [&_article]:before:top-1 [&_article]:before:-left-[1.35rem] [&_article]:before:h-2 [&_article]:before:w-2 [&_article]:before:rounded-full [&_article]:before:bg-admin-accent [&_article]:before:content-[''] [&_span]:text-[0.67rem] [&_span]:text-admin-ink-muted [&_p]:mt-1 [&_p]:mb-0">
              {item.statusHistory.map((record) => (
                <article key={record.id}>
                  <span>
                    {formatDate(record.createdAt)} ·{" "}
                    {record.changedBy?.displayName ?? "System"}
                  </span>
                  <p>
                    {record.fromStatus ?? "Created"} → {record.toStatus}
                    {record.reason ? ` · ${record.reason}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </Card>
        </div>
        <aside className="sticky top-[5.5rem] grid gap-4 max-[900px]:static">
          <Card>
            <h2>Update enquiry status</h2>
            {transitions[item.status].length ? (
              <div className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
                <label>
                  Next status
                  <AdminSelect
                    value={nextStatus}
                    onValueChange={(selectedValue) => setNextStatus(selectedValue)}
                  >
                    <option value="">Choose…</option>
                    {transitions[item.status].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </AdminSelect>
                </label>
                <label>
                  Reason / context
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                {nextStatus === "LOST" || nextStatus === "CLOSED" ? (
                  <ConfirmButton
                    confirmText={`Move to ${nextStatus.toLowerCase()}`}
                    dialogDescription="This changes the sales workflow and records the transition in the audit history."
                    dialogTitle={`Mark enquiry as ${nextStatus.toLowerCase()}?`}
                    detailText={item.reference}
                    disabled={!nextStatus || statusMutation.isPending}
                    onConfirm={() => statusMutation.mutateAsync()}
                    tone={nextStatus === "LOST" ? "danger" : "warning"}
                  >
                    Update status
                  </ConfirmButton>
                ) : (
                  <Button disabled={!nextStatus || statusMutation.isPending} onClick={() => statusMutation.mutate()}>
                    Update status
                  </Button>
                )}
              </div>
            ) : (
              <p>This enquiry is closed.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
