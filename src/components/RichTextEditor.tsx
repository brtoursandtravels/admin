import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Editor } from "@tiptap/core";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Undo2, Unlink } from "lucide-react";
import { AdminSelect } from "./AdminSelect";

const extensions = [StarterKit.configure({
  heading: { levels: [2, 3, 4] }, code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false, trailingNode: false,
  link: { openOnClick: false, defaultProtocol: "https", protocols: ["http", "https", "mailto", "tel"], HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
})];

export default function RichTextEditor({ value, onChange, onBlur, disabled = false, readOnly = false, invalid = false, id = "article-content" }: {
  value: string; onChange?: (html: string) => void; onBlur?: () => void; disabled?: boolean; readOnly?: boolean; invalid?: boolean; id?: string;
}) {
  const editor = useEditor({
    extensions, content: value, editable: !disabled && !readOnly, immediatelyRender: false,
    editorProps: { attributes: { id, role: readOnly ? "document" : "textbox", "aria-label": readOnly ? "Article preview content" : "Article content", "aria-multiline": "true", class: "admin-rich-text", spellcheck: "true" } },
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
    onBlur: () => onBlur?.(),
  });
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(!disabled && !readOnly, false); }, [editor, disabled, readOnly]);
  useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dom.setAttribute("aria-invalid", String(invalid)); }, [editor, invalid]);
  if (!editor || editor.isDestroyed) return <div className="rounded-xl bg-admin-surface-muted p-5 text-sm" role="status">Loading writing tools…</div>;
  return <EditorControls key={editor.instanceId} editor={editor} disabled={disabled} readOnly={readOnly} invalid={invalid} />;
}

function EditorControls({ editor, disabled, readOnly, invalid }: { editor: Editor; disabled: boolean; readOnly: boolean; invalid: boolean }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current.isActive("bold"), italic: current.isActive("italic"), bulletList: current.isActive("bulletList"), orderedList: current.isActive("orderedList"), blockquote: current.isActive("blockquote"), link: current.isActive("link"),
    heading: [2, 3, 4].find(level => current.isActive("heading", { level }))?.toString() ?? "paragraph",
    canUndo: current.can().undo(), canRedo: current.can().redo(), words: current.getText().trim().split(/\s+/).filter(Boolean).length,
  }) });

  const tools = [
    { label: "Bold", Icon: Bold, active: state.bold, action: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", Icon: Italic, active: state.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { label: "Bullet list", Icon: List, active: state.bulletList, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", Icon: ListOrdered, active: state.orderedList, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Quote", Icon: Quote, active: state.blockquote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Add or edit link", Icon: Link2, active: state.link, action: () => { setLinkUrl(String(editor.getAttributes("link").href ?? "")); setLinkError(""); setLinkOpen(!linkOpen); } },
    { label: "Remove link", Icon: Unlink, unavailable: !state.link, action: () => editor.chain().focus().extendMarkRange("link").unsetLink().run() },
    { label: "Clear formatting", Icon: RemoveFormatting, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: "Undo", Icon: Undo2, unavailable: !state.canUndo, action: () => editor.chain().focus().undo().run() },
    { label: "Redo", Icon: Redo2, unavailable: !state.canRedo, action: () => editor.chain().focus().redo().run() },
  ];
  function applyLink() {
    let href = linkUrl.trim();
    if (!href) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); return; }
    if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith("/")) href = `https://${href}`;
    try {
      const url = new URL(href, window.location.origin);
      if (href.startsWith("//") || !["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) throw new Error("Invalid link");
    } catch { setLinkError("Use a website address, email link or phone link."); return; }
    if (editor.state.selection.empty && !state.link) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }] }).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  return <div className={readOnly ? "admin-rich-preview" : `admin-rich-editor ${invalid ? "border-admin-negative!" : ""}`}>
    {!readOnly && <>
      <div className="admin-rich-toolbar" role="group" aria-label="Text formatting">
        <AdminSelect aria-label="Text style" className="w-36! min-h-9! py-1.5! text-xs!" value={state.heading} disabled={disabled} onValueChange={style => style === "paragraph" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(style) as 2 | 3 | 4 }).run()}>
          <option value="paragraph">Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option><option value="4">Small heading</option>
        </AdminSelect>
        {tools.map(({ label, Icon, active, unavailable, action }) => <button type="button" key={label} title={label} aria-label={label} aria-pressed={active} disabled={disabled || unavailable} onMouseDown={event => event.preventDefault()} onClick={action} className={`admin-rich-tool ${active ? "bg-admin-brand! text-white!" : ""}`}><Icon size={17} aria-hidden="true" /></button>)}
      </div>
      {linkOpen && <div className="grid gap-2 border-b border-admin-border bg-admin-surface-muted p-3">
        <label className="grid gap-1 text-xs font-bold">Link address<input className="admin-control" value={linkUrl} placeholder="https://example.com" autoFocus disabled={disabled} onChange={event => setLinkUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") { event.preventDefault(); setLinkOpen(false); editor.commands.focus(); } }} /></label>
        {linkError && <p className="m-0 text-xs text-admin-negative" role="alert">{linkError}</p>}
        <div className="flex gap-2"><button type="button" disabled={disabled} className="rounded-lg bg-admin-brand px-3 py-2 text-xs font-bold text-white" onClick={applyLink}>Apply link</button><button type="button" className="rounded-lg px-3 py-2 text-xs font-bold" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}>Cancel link</button></div>
      </div>}
    </>}
    <EditorContent editor={editor} />
    {!readOnly && <div className="flex flex-wrap justify-between gap-2 border-t border-admin-border px-4 py-2 text-xs text-admin-ink-muted"><span>{state.words} {state.words === 1 ? "word" : "words"} · {Math.max(1, Math.ceil(state.words / 220))} min read</span><span>Paste text or use the formatting tools above.</span></div>}
  </div>;
}
