import { z } from "zod";

export type PublicSetting = { key: string; value: unknown; isPublic: boolean; description: string | null };
type FieldKind = "text" | "email" | "phone" | "instagram" | "facebook" | "url";
export type PublicSettingField = { key: string; label: string; kind: FieldKind; hint: string; placeholder: string; maxLength: number; aliases?: string[] };

export const publicSettingFields: PublicSettingField[] = [
  { key: "contact.email", label: "Email address", kind: "email", hint: "Shown in the website header, footer and contact page.", placeholder: "name@example.com", maxLength: 254, aliases: ["business.email", "email"] },
  { key: "contact.phone", label: "Phone & WhatsApp number", kind: "phone", hint: "One number for calls and WhatsApp across the website. Include the country code.", placeholder: "+91 79907 21001", maxLength: 40, aliases: ["business.phone", "phone"] },
  { key: "social.instagram", label: "Instagram", kind: "instagram", hint: "Paste your Instagram profile link.", placeholder: "https://www.instagram.com/your-profile/", maxLength: 2048, aliases: ["contact.instagram", "instagram"] },
  { key: "social.facebook", label: "Facebook", kind: "facebook", hint: "Paste your Facebook page or profile link.", placeholder: "https://www.facebook.com/your-page", maxLength: 2048, aliases: ["contact.facebook", "facebook"] },
  { key: "contact.address", label: "Office address", kind: "text", hint: "Your public office address.", placeholder: "Street, city, state and postcode", maxLength: 1000, aliases: ["business.address", "address"] },
  { key: "contact.mapUrl", label: "Google Maps link", kind: "url", hint: "Paste the share link for your office location.", placeholder: "https://maps.google.com/...", maxLength: 2048, aliases: ["business.mapUrl", "mapUrl"] },
];

export function publicSettingText(settings: PublicSetting[], field: PublicSettingField): string {
  for (const key of [field.key, ...(field.aliases ?? [])]) {
    const entry = settings.find(item => item.key === key);
    if (!entry) continue;
    if (typeof entry.value === "string") return entry.value;
    if (typeof entry.value === "number") return String(entry.value);
    if (entry.value && typeof entry.value === "object") {
      const value = entry.value as Record<string, unknown>;
      for (const property of ["value", "text", "url", "href", "label"]) if (typeof value[property] === "string") return value[property];
    }
  }
  return "";
}

export function parsePublicSetting(field: PublicSettingField, input: string): string {
  let value = input.trim();
  if (!value) return "";
  if (value.length > field.maxLength) throw new Error(`Use at most ${field.maxLength} characters.`);
  if (field.kind === "email" && !z.email().safeParse(value).success) throw new Error("Enter a valid email address.");
  if (["url", "instagram", "facebook"].includes(field.kind)) {
    if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Enter a valid website link."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use an HTTPS link.");
    if (field.kind === "instagram" || field.kind === "facebook") {
      const domain = `${field.kind}.com`;
      if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) throw new Error(`Enter a ${domain} link.`);
    }
    value = url.toString();
  }
  if (field.kind === "phone" && (!/^\+?[\d\s().-]+$/.test(value) || !/^\d{7,15}$/.test(value.replace(/\D/g, "")))) {
    throw new Error("Enter a phone number with 7 to 15 digits and its country code.");
  }
  return value;
}
