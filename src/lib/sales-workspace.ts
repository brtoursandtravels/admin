export const enquiryStatuses = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "CLOSED", "LOST"] as const;
export const enquiryTypes = { CONTACT: "General enquiry", PACKAGE_ENQUIRY: "Package enquiry", BOOKING_REQUEST: "Booking request" };

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

