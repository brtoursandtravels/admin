import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Button, getErrorMessage, useToast } from "../ui";
import { EditorDialog } from "./EditorDialog";
import { FieldLabel } from "./FieldLabel";

export function AccountEditor({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [name, setName] = useState(auth.user?.displayName ?? "");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const profile = useMutation({
    mutationFn: () => apiRequest("/auth/profile", { method: "PUT", csrfToken: auth.csrfToken, body: { displayName: name.trim() } }),
    onSuccess: async () => {
      await auth.refresh();
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      notify("Account details updated.");
    },
  });
  const password = useMutation({
    mutationFn: () => {
      if (newPassword.length < 14 || newPassword.length > 128) throw new Error("Use a password between 14 and 128 characters.");
      if (newPassword !== confirmation) throw new Error("The new passwords do not match.");
      return apiRequest<void>("/auth/change-password", { method: "POST", csrfToken: auth.csrfToken, body: { currentPassword, newPassword } });
    },
    onSuccess: async () => {
      notify("Password changed. Sign in with your new password.");
      await auth.refresh();
      navigate("/login", { replace: true });
    },
  });
  const busy = profile.isPending || password.isPending;

  return <EditorDialog title="Edit my account" onClose={onClose} busy={busy}>
    <p className="mb-5 break-all text-sm text-admin-ink-muted">{auth.user?.email}</p>
    <form className="admin-form" onSubmit={event => { event.preventDefault(); profile.mutate(); }}>
      <label><FieldLabel required>Name</FieldLabel><input aria-label="Name" required aria-required="true" minLength={2} maxLength={120} autoComplete="name" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      {profile.isError ? <p role="alert" className="text-sm text-admin-negative">{getErrorMessage(profile.error)}</p> : null}
      <Button type="submit" disabled={busy || name.trim().length < 2}>{profile.isPending ? "Saving…" : "Save name"}</Button>
    </form>
    <div className="mt-6 border-t border-admin-border pt-5">
      <Button type="button" variant="secondary" disabled={busy} aria-expanded={changingPassword} onClick={() => { setChangingPassword(!changingPassword); setCurrentPassword(""); setNewPassword(""); setConfirmation(""); password.reset(); }}>{changingPassword ? "Cancel password change" : "Change password"}</Button>
      {changingPassword ? <form className="admin-form mt-4" onSubmit={event => { event.preventDefault(); password.mutate(); }}>
        <fieldset disabled={busy} className="grid min-w-0 gap-4 border-0 p-0">
          <label><FieldLabel required>Current password</FieldLabel><input aria-label="Current password" required aria-required="true" autoComplete="current-password" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
          <label><FieldLabel required>New password</FieldLabel><input aria-label="New password" required aria-required="true" autoComplete="new-password" type="password" maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} /><span className="text-xs font-normal text-admin-ink-muted">Use 14–128 characters. You will be signed out of all devices after saving.</span></label>
          <label><FieldLabel required>Confirm new password</FieldLabel><input aria-label="Confirm new password" required aria-required="true" autoComplete="new-password" type="password" maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
          {password.isError ? <p role="alert" className="text-sm text-admin-negative">{getErrorMessage(password.error)}</p> : null}
          <Button type="submit">{password.isPending ? "Saving…" : "Save password and sign out"}</Button>
        </fieldset>
      </form> : null}
    </div>
  </EditorDialog>;
}
