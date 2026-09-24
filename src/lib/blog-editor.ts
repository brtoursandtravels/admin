import { z } from "zod";
import type { PublicationStatus } from "../types";

export type BlogCategory = { id: string; name: string; slug: string; status: PublicationStatus };
export type BlogSummary = { id: string; slug: string; title: string; excerpt: string; status: PublicationStatus; publishedAt: string | null; updatedAt: string; coverMedia: { id: string; altText: string; visibility: "PUBLIC" | "PRIVATE" } | null };
export type BlogPost = BlogSummary & {
  contentHtml: string; categoryId: string | null; coverMediaId: string | null;
  seoTitle: string | null; seoDescription: string | null; isFeatured: boolean; isDemo: boolean;
  relatedTours: Array<{ package: { id: string; title: string } }>;
};

export function articleText(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style").forEach(element => element.remove());
  document.querySelectorAll("p,h2,h3,h4,li,blockquote,br").forEach(element => element.append(" "));
  return (document.body.textContent ?? "").replace(/[\s\u200b-\u200d\ufeff]+/g, " ").trim();
}

export const blogSchema = z.object({
  title: z.string().trim().min(2, "Enter an article title of at least 2 characters.").max(220),
  slug: z.string().min(2, "Enter a title to create the article address.").max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  excerpt: z.string().trim().min(10, "Add a short description of at least 10 characters.").max(500),
  contentHtml: z.string().max(300_000, "This article is too long. Please shorten it.").refine(value => articleText(value).length >= 10, "Write at least 10 characters of article content."),
  categoryId: z.string(), coverMediaId: z.string(),
  seoTitle: z.string().max(70), seoDescription: z.string().max(170), relatedPackageIds: z.array(z.string()).max(30),
  isFeatured: z.boolean(), isDemo: z.boolean(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().refine(value => !value || !Number.isNaN(new Date(value).getTime()), "Choose a valid publication date and time."),
});
export type BlogForm = z.infer<typeof blogSchema>;
export const blankBlog: BlogForm = { title: "", slug: "", excerpt: "", contentHtml: "<p></p>", categoryId: "", coverMediaId: "", seoTitle: "", seoDescription: "", relatedPackageIds: [], isFeatured: false, isDemo: false, status: "DRAFT", publishedAt: "" };

export function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function blogToForm(post: BlogPost): BlogForm {
  return { title: post.title, slug: post.slug, excerpt: post.excerpt, contentHtml: post.contentHtml, categoryId: post.categoryId ?? "", coverMediaId: post.coverMediaId ?? "", seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", relatedPackageIds: post.relatedTours.map(item => item.package.id), isFeatured: post.isFeatured, isDemo: post.isDemo, status: post.status, publishedAt: localDateTime(post.publishedAt) };
}
export function blogPayload(value: BlogForm, post?: BlogPost) {
  return { ...value, categoryId: value.categoryId || null, coverMediaId: value.coverMediaId || null, seoTitle: value.seoTitle.trim() || null, seoDescription: value.seoDescription.trim() || null, publishedAt: post && value.publishedAt === localDateTime(post.publishedAt) ? post.publishedAt : value.publishedAt ? new Date(value.publishedAt).toISOString() : null };
}
export function articleSlug(title: string, suffix: string) {
  const titlePart = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160).replace(/-$/g, "");
  return `${titlePart || "article"}-${suffix}`;
}
