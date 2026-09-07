import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import type { AdminUser, Role } from "../types";
import {
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
  const { notify } = useToast();
  const client = useQueryClient();
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
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const edit = (user: AdminUser) => {
    setEditing(user);
    setDraft({
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status ?? "ACTIVE",
      password: "",
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Staff users and roles"
        description="Create staff accounts, change role/status, and protect the last active Super Admin. Password hashes and sessions are never returned."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDraft(blankUser);
            }}
          >
            New staff user
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
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
                        <Button variant="secondary" onClick={() => edit(user)}>
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
        <Card>
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{editing ? "Edit access" : "New account"}</p>
          <h2>{editing?.displayName ?? "Create staff user"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
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
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    role: event.target.value as Role,
                  }))
                }
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            {editing ? (
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      status: event.target.value as UserDraft["status"],
                    }))
                  }
                >
                  <option>ACTIVE</option>
                  <option>DISABLED</option>
                </select>
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
                  onClick={() => {
                    setEditing(null);
                    setDraft(blankUser);
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

type AuditRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  actor: { id: string; displayName: string } | null;
  createdAt: string;
};
export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const query = useQuery({
    queryKey: ["audit-logs", page, entityType],
    queryFn: () =>
      apiRequest<PageResponse<AuditRecord>>(
        `/admin/audit-logs?${new URLSearchParams({ page: String(page), pageSize: "25", ...(entityType ? { entityType } : {}) })}`,
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Audit trail"
        description="Review security and content mutations with actor, request reference and before/after context."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.8rem] border border-admin-border bg-admin-surface p-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&_input]:min-w-48 [&_select]:min-w-48">
        <label>
          Entity type
          <input
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            placeholder="Package, Enquiry, AdminUser…"
          />
        </label>
      </div>
      <Card className="overflow-hidden p-0!">
        {query.isPending ? (
          <LoadingPanel />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title="No audit records"
            description="No audit events match this filter."
          />
        ) : (
          <>
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Time</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">
                          {item.action.replaceAll("_", " ")}
                        </span>
                        <small>
                          {item.requestId ?? "No request reference"}
                        </small>
                      </td>
                      <td>
                        {item.entityType}
                        <small>{item.entityId ?? "—"}</small>
                      </td>
                      <td>{item.actor?.displayName ?? "System"}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <details className="[&_summary]:text-[0.72rem] [&_summary]:font-bold [&_summary]:text-admin-brand [&_pre]:max-w-lg [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded-lg [&_pre]:bg-admin-brand-deep [&_pre]:p-3 [&_pre]:text-[0.68rem] [&_pre]:text-white">
                          <summary>View change</summary>
                          <pre>
                            {JSON.stringify(
                              { before: item.before, after: item.after },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={query.data.meta} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
