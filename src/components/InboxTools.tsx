import { useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { Button } from "../ui";
import { readableLabel } from "../lib/sales-workspace";

export function InboxSearch({ initialValue, label, placeholder, onSearch }: { initialValue: string; label: string; placeholder: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <form role="search" aria-label={label} className="flex min-w-0 flex-1 basis-full flex-wrap items-end gap-2 sm:basis-72" onSubmit={event => { event.preventDefault(); onSearch(value.trim()); }}>
    <label className="grid min-w-0 flex-1 basis-48 gap-2 text-sm font-bold">{label}
      <span className="relative"><Search className="pointer-events-none absolute top-3.5 left-3 text-admin-ink-subtle" size={17} aria-hidden="true" /><input className="admin-control pl-10! pr-10!" type="search" aria-label={label} value={value} maxLength={120} placeholder={placeholder} onChange={event => setValue(event.target.value)} />{value ? <button className="absolute top-2 right-2 rounded-lg p-2 text-admin-ink-muted hover:bg-admin-surface-muted" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { setValue(""); onSearch(""); }}><X size={16} aria-hidden="true" /></button> : null}</span>
    </label>
    <Button variant="secondary" type="submit">Search</Button>
  </form>;
}

export function InboxStatusFilters({ statuses, value, onChange, label }: { statuses: readonly string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
    {["", ...statuses].map(status => <button key={status} type="button" aria-pressed={value === status} className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors ${status === value ? "bg-admin-brand text-white" : "bg-admin-surface-muted text-admin-ink-muted hover:bg-admin-brand-soft"}`} onClick={() => onChange(status)}>{status ? readableLabel(status) : "All"}</button>)}
  </div>;
}

export function InboxRefresh({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return <Button type="button" variant="secondary" disabled={busy} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" className={busy ? "animate-spin" : ""} />{busy ? "Refreshing..." : "Refresh"}</Button>;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
export function InboxDate({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value} className="block whitespace-nowrap text-xs leading-5">{dateFormat.format(date)}<span className="block text-admin-ink-subtle">{timeFormat.format(date)} IST</span></time>;
}
