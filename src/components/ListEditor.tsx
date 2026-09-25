import { useState } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { Button, useConfirm, useToast } from "../ui";
import { FieldLabel } from "./FieldLabel";

export function ListEditor({ label, value, onChange, presets = [], maxItems = 100, maxLength = 500, tokens = false, negative = false, required = false }: { label: string; value: string; onChange: (value: string) => void; presets?: string[]; maxItems?: number; maxLength?: number; tokens?: boolean; negative?: boolean; required?: boolean }) {
  const [draft, setDraft] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const confirm = useConfirm();
  const { notify } = useToast();
  const items = value.split("\n").map(item => item.trim()).filter(Boolean);
  function add(text = draft) {
    const next = [...items];
    for (const part of text.split("\n").map(item => item.trim()).filter(Boolean)) {
      if (part.length > maxLength) { notify(`Keep each item within ${maxLength} characters.`, "error"); return; }
      if (!next.some(item => item.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    if (next.length > maxItems) { notify(`Add up to ${maxItems} items.`, "error"); return; }
    onChange(next.join("\n")); setDraft("");
  }
  function move(from: number, to: number) { const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]!); onChange(next.join("\n")); }
  return <fieldset className="min-w-0 rounded-xl border border-admin-border p-4">
    <legend className="px-2 text-sm font-bold"><FieldLabel required={required}>{label}</FieldLabel></legend>
    <ul className={tokens ? "m-0 mb-3 flex list-none flex-wrap gap-2 p-0" : "m-0 mb-3 grid list-none gap-2 p-0"}>
      {items.map((item, index) => <li key={`${index}-${item}`} draggable={!tokens} onDragStart={() => setDragIndex(index)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }} className={`flex min-w-0 items-center gap-2 bg-admin-surface-muted px-3 py-2 ${tokens ? "rounded-full" : "rounded-lg"}`}>
        {negative ? <X size={15} className="shrink-0 text-admin-negative" /> : <Check size={15} className="shrink-0 text-admin-positive" />}
        <span className="min-w-0 flex-1 break-words text-sm">{item}</span>
        {!tokens ? <><button type="button" aria-label={`Move ${label} item ${index + 1} up`} disabled={index === 0} onClick={() => move(index, index - 1)} className="p-1 disabled:opacity-30"><ArrowUp size={14} /></button><button type="button" aria-label={`Move ${label} item ${index + 1} down`} disabled={index === items.length - 1} onClick={() => move(index, index + 1)} className="p-1 disabled:opacity-30"><ArrowDown size={14} /></button></> : null}
        <button type="button" aria-label={`Remove ${item}`} className="p-1 text-admin-negative" onClick={() => void confirm({ title: `Remove from ${label.toLowerCase()}?`, message: "Save the package to apply this change.", detailText: item, confirmText: "Remove item", tone: "warning", action: () => onChange(items.filter((_, i) => i !== index).join("\n")) })}><X size={14} /></button>
      </li>)}
    </ul>
    <div className="flex gap-2"><input className="admin-control min-w-0 flex-1" aria-label={`Add ${label.toLowerCase()}`} placeholder="Type an item and press Enter" value={draft} maxLength={maxLength} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><Button type="button" variant="secondary" disabled={!draft.trim()} onClick={() => add()}>Add</Button></div>
    {presets.length ? <div className="mt-3 flex flex-wrap gap-2">{presets.filter(item => !items.includes(item)).map(item => <button type="button" key={item} onClick={() => add(item)} className="rounded-full border border-admin-border px-3 py-1 text-xs">+ {item}</button>)}</div> : null}
  </fieldset>;
}
