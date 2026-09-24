import { useState } from "react";

export function MultiChoiceField({ label, options, value, onChange, limit, disabled, emptyText = "No options available yet." }: {
  label: string; options: Array<{ id: string; label: string }>; value: string[]; onChange: (value: string[]) => void; limit: number; disabled?: boolean; emptyText?: string;
}) {
  const [search, setSearch] = useState("");
  const visible = options.filter(option => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <fieldset className="min-w-0 rounded-xl border border-admin-border p-3" disabled={disabled}>
    <legend className="px-1 text-sm font-bold text-admin-brand-deep">{label}</legend>
    <p className="mt-0 mb-2 text-xs text-admin-ink-muted">{value.length}/{limit} selected</p>
    {options.length > 6 && <input type="search" className="admin-control mb-2" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search options" value={search} onChange={event => setSearch(event.target.value)} />}
    <div className="grid max-h-52 gap-1 overflow-y-auto">
      {visible.map(option => <label key={option.id} className={`flex! min-h-10 cursor-pointer items-center gap-2! rounded-lg px-2 py-2 text-sm! font-normal! hover:bg-admin-surface-muted ${value.includes(option.id) ? "bg-admin-brand-soft text-admin-brand!" : ""}`}><input type="checkbox" className="size-4 shrink-0 accent-admin-brand" checked={value.includes(option.id)} disabled={disabled || (!value.includes(option.id) && value.length >= limit)} onChange={event => onChange(event.target.checked ? [...value, option.id] : value.filter(id => id !== option.id))} /><span className="min-w-0 wrap-anywhere">{option.label}</span></label>)}
      {!visible.length && <p className="m-0 py-2 text-xs text-admin-ink-muted">{search ? "No matching options." : emptyText}</p>}
    </div>
  </fieldset>;
}
