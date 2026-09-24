import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { parsePublicSetting, publicSettingFields, publicSettingText, type PublicSetting, type PublicSettingField } from "../lib/public-settings";
import { Button, Card, ErrorPanel, LoadingPanel, PageHeader, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

export default function PublicSettingsPage() {
  const query = useQuery({ queryKey: ["settings"], queryFn: () => apiRequest<DataResponse<PublicSetting[]>>("/admin/settings") });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const settings = query.data?.data ?? [];
  useUnsavedChanges(publicSettingFields.some(field => drafts[field.key] !== undefined && drafts[field.key] !== publicSettingText(settings, field)));
  function clearDraft(key: string) { setDrafts(current => { const next = { ...current }; delete next[key]; return next; }); }
  return <>
    <PageHeader eyebrow="Website" title="Public settings" description="Edit your contact details and social links. Press Enter or Save for each row. Leave an optional field blank and save to hide it." />
    {query.isPending ? <LoadingPanel /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : <Card className="overflow-hidden p-0!">
      <div aria-hidden="true" className="hidden grid-cols-[14rem_minmax(0,1fr)_10rem] gap-5 border-b border-admin-border bg-admin-surface-muted px-5 py-3 text-xs font-bold uppercase tracking-wide text-admin-ink-muted lg:grid"><span>Contact detail</span><span>Value</span><span>Actions</span></div>
      <ul aria-label="Public settings" className="m-0 list-none divide-y divide-admin-border-soft p-0">{publicSettingFields.map(field => {
        const savedValue = publicSettingText(settings, field);
        return <SettingRow key={field.key} field={field} value={drafts[field.key] ?? savedValue} dirty={drafts[field.key] !== undefined && drafts[field.key] !== savedValue} onChange={value => setDrafts(current => ({ ...current, [field.key]: value }))} onSaved={() => clearDraft(field.key)} onCancel={() => clearDraft(field.key)} />;
      })}</ul>
    </Card>}
    <p className="mt-4 text-sm text-admin-ink-muted">Saved changes appear on the public website after its next refresh, usually within 30 seconds. Manage page titles and descriptions in <Link to="/content/seo" className="font-bold text-admin-brand underline">Page SEO</Link>.</p>
  </>;
}

function SettingRow({ field, value, dirty, onChange, onSaved, onCancel }: {
  field: PublicSettingField; value: string; dirty: boolean; onChange: (value: string) => void; onSaved: () => void; onCancel: () => void;
}) {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [validationError, setValidationError] = useState("");
  const save = useMutation({
    mutationFn: (text: string) => apiRequest<DataResponse<PublicSetting>>(`/admin/settings/${encodeURIComponent(field.key)}`, {
      method: "PUT", csrfToken, body: { value: text, isPublic: true, description: field.label },
    }),
    onSuccess: result => {
      client.setQueryData<DataResponse<PublicSetting[]>>(["settings"], current => ({ data: [...(current?.data ?? []).filter(item => item.key !== field.key), result.data] }));
      onSaved();
      void client.invalidateQueries({ queryKey: ["settings"] });
      notify(`${field.label} saved.`);
    },
  });
  const error = validationError || (save.isError ? getErrorMessage(save.error) : "");
  const inputId = `setting-${field.key}`;
  return <li className="px-5 py-4">
    <form noValidate aria-label={field.label} onSubmit={event => {
      event.preventDefault(); if (!dirty || save.isPending) return;
      try { setValidationError(""); save.mutate(parsePublicSetting(field, value)); }
      catch (error) { setValidationError(getErrorMessage(error)); }
    }}>
      <fieldset disabled={save.isPending} className="m-0 grid min-w-0 items-start gap-3 border-0 p-0 lg:grid-cols-[14rem_minmax(0,1fr)_10rem] lg:gap-5">
        <div className="min-w-0"><label htmlFor={inputId} className="text-sm font-bold text-admin-brand-deep">{field.label}</label><p id={`${inputId}-hint`} className="mt-1 mb-0 text-xs leading-5 text-admin-ink-muted">{field.hint}</p></div>
        <div className="min-w-0"><input id={inputId} className="admin-control" type={field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "text"} inputMode={field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : field.kind === "text" ? "text" : "url"} autoComplete={field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "off"} value={value} maxLength={field.maxLength} placeholder={field.placeholder} aria-invalid={Boolean(error)} aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`} onChange={event => { setValidationError(""); if (save.isError) save.reset(); onChange(event.target.value); }} />
          {error && <p id={`${inputId}-error`} role="alert" className="mt-2 mb-0 text-xs text-admin-negative">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>{dirty && <Button type="button" variant="ghost" onClick={() => { setValidationError(""); save.reset(); onCancel(); }}>Cancel</Button>}</div>
      </fieldset>
    </form>
  </li>;
}
