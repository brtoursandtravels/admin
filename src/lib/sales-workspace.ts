export const enquiryStatuses = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "CLOSED", "LOST"] as const;
export const enquiryTypes = { CONTACT: "General enquiry", PACKAGE_ENQUIRY: "Package enquiry", BOOKING_REQUEST: "Booking request" };

export type EnquiryStatus = typeof enquiryStatuses[number];
export const enquiryWorkflow: Record<EnquiryStatus, { label: string; hint: string; action: string; tone: string }> = {
  NEW: { label: "Needs reply", hint: "Read the request and contact the traveller.", action: "New request", tone: "bg-admin-warning-soft text-admin-warning" },
  CONTACTED: { label: "Contacted", hint: "Record the conversation and agree on the next step.", action: "Mark as contacted", tone: "bg-admin-brand-soft text-admin-brand" },
  QUOTED: { label: "Quote sent", hint: "Follow up on the quote and record the traveller’s decision.", action: "Mark quote as sent", tone: "bg-admin-brand-soft text-admin-brand" },
  CONFIRMED: { label: "Confirmed", hint: "Arrange the final details and close the enquiry when finished.", action: "Mark as confirmed", tone: "bg-admin-positive-soft text-admin-positive" },
  CLOSED: { label: "Closed", hint: "This request is complete. Its notes are kept for reference.", action: "Close enquiry", tone: "bg-admin-surface-muted text-admin-ink-muted" },
  LOST: { label: "Not proceeding", hint: "Reopen the conversation if the traveller is interested again.", action: "Mark as not proceeding", tone: "bg-admin-negative-soft text-admin-negative" },
};
export const enquiryTransitions: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["CONTACTED", "LOST"], CONTACTED: ["QUOTED", "CLOSED", "LOST"],
  QUOTED: ["CONFIRMED", "CLOSED", "LOST"], CONFIRMED: ["CLOSED", "LOST"],
  CLOSED: [], LOST: ["CONTACTED"],
};

export function whatsappContact(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (!phone.trim().startsWith("+") && digits.length === 10) digits = `91${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

export function readableLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}
export function listPage(params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1);
  const size = Number(params.get("pageSize") ?? 25);
  return { page: Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1, pageSize: [10, 25, 50, 100].includes(size) ? size : 25 };
}

export type EnquiryListItem = {
  id: string; reference: string; type: string; status: typeof enquiryStatuses[number];
  requester: { name: string; email: string; phone: string | null };
  packageTitle: string | null;
  assignedTo: { id: string; displayName: string } | null;
  createdAt: string; updatedAt: string;
};

