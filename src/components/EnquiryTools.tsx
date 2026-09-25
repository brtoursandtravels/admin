import { Mail, MessageCircle, Phone } from "lucide-react";
import { enquiryWorkflow, whatsappContact, type EnquiryStatus } from "../lib/sales-workspace";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const item = enquiryWorkflow[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${item.tone}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{item.label}</span>;
}

export function EnquiryContactActions({ email, phone }: { email: string; phone: string | null }) {
  const whatsapp = whatsappContact(phone);
  const linkClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-sm font-bold text-admin-brand no-underline transition hover:bg-admin-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-brand";
  return <div className="flex flex-wrap gap-2" aria-label="Contact traveller">
    {phone ? <a className={linkClass} href={`tel:${phone}`}><Phone size={15} aria-hidden="true" />Call</a> : null}
    {whatsapp ? <a className={linkClass} href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" />WhatsApp</a> : null}
    <a className={linkClass} href={`mailto:${email}`}><Mail size={15} aria-hidden="true" />Email</a>
  </div>;
}
