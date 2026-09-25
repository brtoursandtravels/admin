import { FieldLabel } from "../components/FieldLabel";
import { AdminSelect } from "../components/AdminSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import type { AdminUser } from "../types";
import {
  ActionLink, BackLink, Button, Card, EmptyState, ErrorPanel, LoadingPanel,
  PageHeader, StatusBadge, formatDate, getErrorMessage, useConfirm, useToast,
  useUnsavedChanges,
} from "../ui";

export function UsersPage() {
  const auth = useAuth();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiRequest<DataResponse<AdminUser[]>>("/admin/users"),
  });
  const editing = users.data?.data.find(user => user.id === id);

  return <>
    <PageHeader eyebrow="Staff accounts" title={editorOpen ? (id ? "Edit staff user" : "New staff user") : "Staff users"}
      description={editorOpen ? "Manage the name, email address and password used to sign in." : "Add staff accounts or edit their details and passwords."}
      actions={editorOpen ? <BackLink to="/users" /> : <ActionLink to="/users/new">New staff user</ActionLink>} />
    {editorOpen ? <div className="max-w-3xl">
      {id && users.isPending ? <LoadingPanel label="Loading staff account…" /> : id && users.isError ?
        <ErrorPanel error={users.error} retry={() => void users.refetch()} /> : id && !editing ?
        <EmptyState title="Staff user not found" description="This account is no longer available. Return to the staff list." /> :
        <StaffUserForm key={id ?? "new"} user={editing} />}
    </div> : <Card className="overflow-hidden p-0!">
      {users.isPending ? <LoadingPanel /> : users.isError ? <ErrorPanel error={users.error} retry={() => void users.refetch()} /> :
        !users.data.data.length ? <EmptyState title="No staff users" description="Create a staff account to get started." /> :
        <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-xs [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:text-sm">
          <table><thead><tr><th>Name and email</th><th>Status</th><th>Last login</th><th>Action</th></tr></thead>
            <tbody>{users.data.data.map(user => <tr key={user.id}>
              <td><strong className="block text-admin-brand-deep">{user.displayName}{user.id === auth.user?.id ? " · You" : ""}</strong><span className="mt-1 block text-xs text-admin-ink-muted">{user.email}</span></td>
              <td><StatusBadge value={user.status ?? "ACTIVE"} /></td><td>{formatDate(user.lastLoginAt)}</td>
              <td><ActionLink variant="secondary" to={`/users/${user.id}/edit`}>Edit</ActionLink></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </Card>}
  </>;
}

function StaffUserForm({ user }: { user?: AdminUser }) {
  const auth = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [status, setStatus] = useState(user?.status ?? "ACTIVE");
  const [changePassword, setChangePassword] = useState(!user);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = email !== (user?.email ?? "") || displayName !== (user?.displayName ?? "") || status !== (user?.status ?? "ACTIVE") || Boolean(password || confirmation);
  useUnsavedChanges(dirty && !saved);
  const save = useMutation({
    mutationFn: () => apiRequest<DataResponse<AdminUser>>(user ? `/admin/users/${user.id}` : "/admin/users", {
      method: user ? "PUT" : "POST", csrfToken: auth.csrfToken,
      body: { email: email.trim(), displayName: displayName.trim(), ...(user ? { status } : {}), ...(changePassword ? { password } : {}) },
    }),
    onSuccess: async () => {
      setSaved(true);
      notify(user ? "Staff user updated." : "Staff user created.");
      const ownCredentialsChanged = user?.id === auth.user?.id && (changePassword || email.trim().toLowerCase() !== user?.email || status === "DISABLED");
      if (ownCredentialsChanged) {
        await auth.refresh();
        navigate("/login", { replace: true });
        return;
      }
      if (user?.id === auth.user?.id) await auth.refresh();
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      navigate("/users");
    },
    onError: cause => setError(getErrorMessage(cause)),
  });
  function submit() {
    setError("");
    if (displayName.trim().length < 2) return setError("Enter a name with at least 2 characters.");
    if (changePassword && (password.length < 14 || password.length > 128)) return setError("Use a password between 14 and 128 characters.");
    if (user && changePassword && password !== confirmation) return setError("The new passwords do not match.");
    if (user && status === "DISABLED" && user.status !== "DISABLED") {
      void confirm({ title: "Disable staff account?", message: "This user will lose access to the admin panel.", detailText: user.displayName, confirmText: "Disable account", tone: "danger", action: () => save.mutateAsync() });
    } else save.mutate();
  }

  return <Card>
    <h2>{user ? "Account details" : "Create staff account"}</h2>
    <form className="admin-form mt-5" onSubmit={event => { event.preventDefault(); submit(); }}>
      <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 border-0 p-0">
        <label><FieldLabel required>Name</FieldLabel><input aria-label="Name" required aria-required="true" autoComplete="name" maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
        <label><FieldLabel required>Email address</FieldLabel><input aria-label="Email address" required aria-required="true" type="email" autoComplete="username" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        {user ? <label><FieldLabel required>Status</FieldLabel><AdminSelect aria-label="Status" aria-required="true" value={status} onValueChange={value => setStatus(value as "ACTIVE" | "DISABLED")}><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></AdminSelect></label> : null}
        {user ? <Button type="button" variant="secondary" aria-expanded={changePassword} onClick={() => { setChangePassword(!changePassword); setPassword(""); setConfirmation(""); setError(""); }}>{changePassword ? "Cancel password change" : "Change password"}</Button> : null}
        {changePassword ? <>
          <label><FieldLabel required>{user ? "New password" : "Password"}</FieldLabel><input aria-label={user ? "New password" : "Password"} required aria-required="true" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /><span className="text-xs font-normal text-admin-ink-muted">Use 14–128 characters.{user ? " Saving will sign this user out of all devices." : ""}</span></label>
          {user ? <label><FieldLabel required>Confirm new password</FieldLabel><input aria-label="Confirm new password" required aria-required="true" type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label> : null}
        </> : null}
        {user && email.trim().toLowerCase() !== user.email ? <p className="m-0 text-sm text-admin-ink-muted">Changing the email address signs this user out. They will sign in with the new email.</p> : null}
        {error ? <p role="alert" className="m-0 rounded-lg bg-admin-negative-soft p-3 text-sm text-admin-negative">{error}</p> : null}
        <div className="flex flex-wrap gap-3"><Button type="submit">{save.isPending ? "Saving…" : user ? "Save changes" : "Create user"}</Button><Button type="button" variant="secondary" onClick={() => navigate("/users")}>Cancel</Button></div>
      </fieldset>
    </form>
  </Card>;
}
