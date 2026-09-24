import { AdminSelect } from "../components/AdminSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import type { AdminUser, Role } from "../types";
import {
  ActionLink,
  BackLink,
  Button,
  Card,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  formatDate,
  getErrorMessage,
  useConfirm,
  useToast,
} from "../ui";

const roles: Role[] = ["SUPER_ADMIN", "CONTENT_EDITOR", "SALES_AGENT"];
type UserDraft = {
  email: string;
  displayName: string;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  password: string;
};
const blankUser: UserDraft = {
  email: "",
  displayName: "",
  role: "CONTENT_EDITOR",
  status: "ACTIVE",
  password: "",
};

export function UsersPage() {
  const auth = useAuth();
  const confirm = useConfirm();
  const { notify } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState<UserDraft>(blankUser);
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<DataResponse<AdminUser[]>>("/admin/users"),
  });
  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiRequest<DataResponse<AdminUser>>(`/admin/users/${editing.id}`, {
            method: "PUT",
            csrfToken: auth.csrfToken,
            body: {
              displayName: draft.displayName,
              role: draft.role,
              status: draft.status,
            },
          })
        : apiRequest<DataResponse<AdminUser>>("/admin/users", {
            method: "POST",
            csrfToken: auth.csrfToken,
            body: {
              email: draft.email,
              displayName: draft.displayName,
              role: draft.role,
              password: draft.password,
            },
          }),
    onSuccess: async () => {
      notify(
        `Staff user ${editing ? "updated; affected sessions were revoked" : "created"}.`,
      );
      setEditing(null);
      setDraft(blankUser);
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      navigate("/users");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        setDraft(blankUser);
        return;
      }
      const record = users.data?.data.find((user) => user.id === id);
      if (!record) return;
      setEditing(record);
      setDraft({
        email: record.email,
        displayName: record.displayName,
        role: record.role,
        status: record.status ?? "ACTIVE",
        password: "",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, id, users.data]);
  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title={editorOpen ? (editing ? "Edit staff access" : "New staff user") : "Staff users and roles"}
        description="Create staff accounts, change role/status, and protect the last active Super Admin. Password hashes and sessions are never returned."
        actions={
          editorOpen ? (
            <BackLink to="/users" />
          ) : (
            <ActionLink to="/users/new">New staff user</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-3xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
        <Card className="overflow-hidden p-0!">
          {users.isPending ? (
            <LoadingPanel />
          ) : users.isError ? (
            <ErrorPanel
              error={users.error}
              retry={() => void users.refetch()}
            />
          ) : users.data.data.length === 0 ? (
            <EmptyState
              title="No staff users"
              description="The current account should always appear here."
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.data.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{user.displayName}</span>
                        <small>
                          {user.email}
                          {user.id === auth.user?.id ? " · You" : ""}
                        </small>
                      </td>
                      <td>{user.role.replaceAll("_", " ")}</td>
                      <td>
                        <StatusBadge value={user.status ?? "ACTIVE"} />
                      </td>
                      <td>{formatDate(user.lastLoginAt)}</td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/users/${user.id}/edit`)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        ) : null}
        {editorOpen ? id && users.isError ? (
          <ErrorPanel error={users.error} retry={() => void users.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label="Loading staff account…" />
        ) : (
        <Card>
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{editing ? "Edit access" : "New account"}</p>
          <h2>{editing?.displayName ?? "Create staff user"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
              const accessChanged =
                editing &&
                (draft.status !== editing.status || draft.role !== editing.role);
              if (accessChanged) {
                void confirm({
                  title:
                    draft.status === "DISABLED"
                      ? "Deactivate staff account?"
                      : "Confirm access change",
                  message:
                    draft.status === "DISABLED"
                      ? "This user will immediately lose access to the admin panel."
                      : "Changing this user's role can add or remove access to sensitive admin sections.",
                  detailText: `${editing.displayName} · ${editing.role.replaceAll("_", " ")} → ${draft.role.replaceAll("_", " ")} · ${draft.status}`,
                  confirmText:
                    draft.status === "DISABLED"
                      ? "Deactivate user"
                      : "Apply access change",
                  tone: draft.status === "DISABLED" ? "danger" : "warning",
                  action: () => save.mutateAsync(),
                });
                return;
              }
              save.mutate();
            }}
          >
            <label>
              Email
              <input
                disabled={Boolean(editing)}
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, email: event.target.value }))
                }
              />
            </label>
            <label>
              Display name
              <input
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Role
              <AdminSelect
                value={draft.role}
                onValueChange={(selectedValue) =>
                  setDraft((value) => ({
                    ...value,
                    role: selectedValue as Role,
                  }))
                }
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </AdminSelect>
              <span className="text-[0.68rem] font-normal leading-5 text-admin-ink-subtle">
                {draft.role === "SUPER_ADMIN"
                  ? "Full catalogue, sales, staff and security access."
                  : draft.role === "CONTENT_EDITOR"
                    ? "Can manage packages and public website content."
                    : "Can manage enquiries and traveller follow-up."}
              </span>
            </label>
            {editing ? (
              <label>
                Status
                <AdminSelect
                  value={draft.status}
                  onValueChange={(selectedValue) =>
                    setDraft((value) => ({
                      ...value,
                      status: selectedValue as UserDraft["status"],
                    }))
                  }
                >
                  <option>ACTIVE</option>
                  <option>DISABLED</option>
                </AdminSelect>
                <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                  Disabling a user or changing their role revokes affected
                  sessions.
                </span>
              </label>
            ) : (
              <label>
                Temporary initial password
                <input
                  autoComplete="new-password"
                  type="password"
                  value={draft.password}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      password: event.target.value,
                    }))
                  }
                />
                <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                  At least 14 characters; communicate outside source control.
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                disabled={
                  save.isPending ||
                  draft.displayName.trim().length < 2 ||
                  (!editing && (draft.password.length < 14 || !draft.email))
                }
                type="submit"
              >
                {editing ? "Save access" : "Create user"}
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/users")}
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

type AuditRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  actor: { id: string | null; displayName: string; email: string | null; role: string | null } | null;
  createdAt: string;
};
const activityDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
});
const activityLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [entityType, setEntityType] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["audit-logs", page, pageSize, filters],
    queryFn: ({ signal }) =>
      apiRequest<PageResponse<AuditRecord>>(
        `/admin/audit-logs?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...filters })}`,
        { signal },
      ),
  });
  const visibleRecords = query.data?.data ?? [];
  const applyFilters = () => {
    setFilters(Object.fromEntries(Object.entries({ entityType, action: actionFilter, actor: actorFilter, date: dateFilter, ipAddress: ipFilter })
      .map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)));
    setPage(1);
  };
  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Activity logs"
        description="Review actions, user details, IP addresses and exact times. Dates and times use IST (Asia/Kolkata)."
        actions={<Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh logs</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.8rem] border border-admin-border bg-admin-surface p-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_input]:min-w-48 [&_select]:min-w-48">
        <label>
          Entity type
          <input
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
            }}
            placeholder="Package, Enquiry, AdminUser…"
          />
        </label>
        <label>
          Action performed
          <input value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} placeholder="Package updated, login..." maxLength={120} />
        </label>
        <label>
          User
          <input value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} placeholder="Name, email or user ID" maxLength={254} />
        </label>
        <label>
          Date (IST)
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </label>
        <label>
          IP address
          <input value={ipFilter} onChange={(event) => setIpFilter(event.target.value)} placeholder="Exact IPv4 or IPv6 address" maxLength={45} />
        </label>
        <Button onClick={applyFilters}>Apply filters</Button>
        <Button variant="secondary" onClick={() => {
          setEntityType(""); setActionFilter(""); setActorFilter(""); setDateFilter(""); setIpFilter(""); setFilters({}); setPage(1);
        }}>Reset</Button>
      </div>
      <p className="text-sm text-admin-ink-subtle">IP addresses and user snapshots are recorded for new activity. Older entries may show “Not recorded”. Filters search all logs.</p>
      <Card className="overflow-hidden p-0!">
        {query.isPending ? (
          <LoadingPanel />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : visibleRecords.length === 0 ? (
          <EmptyState
            title="No activity logs"
            description="No activity matches the selected filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Action performed</th>
                    <th>Affected record</th>
                    <th>User details</th>
                    <th>IP address</th>
                    <th>Date &amp; time (IST)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">
                          {activityLabel(item.action)}
                        </span>
                        <small>
                          {item.requestMethod && item.requestPath ? `${item.requestMethod} ${item.requestPath}` : "Request not recorded"}
                        </small>
                      </td>
                      <td>
                        {item.entityType}
                        <small>{item.entityId ?? "—"}</small>
                      </td>
                      <td>
                        <strong>{item.actor?.displayName ?? "System / unavailable"}</strong>
                        <small>{item.actor?.email ?? "Email not recorded"}</small>
                        <small>{item.actor?.role ? activityLabel(item.actor.role) : "Role not recorded"}</small>
                      </td>
                      <td className="font-mono">{item.ipAddress ?? "Not recorded"}</td>
                      <td className="whitespace-nowrap"><time dateTime={item.createdAt}>{activityDateFormat.format(new Date(item.createdAt))}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={query.data.meta} onPage={setPage} onPageSize={(next) => { setPageSize(next); setPage(1); }} />
          </>
        )}
      </Card>
    </>
  );
}
