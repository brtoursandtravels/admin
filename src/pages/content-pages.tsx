/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  apiRequest,
  privateMediaUrl,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import { parseMenuLines } from "../lib/navigation";
import type { MediaAsset, PackageRecord, PublicationStatus } from "../types";
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  getErrorMessage,
  useToast,
  useUnsavedChanges,
} from "../ui";

const slug = z
  .string()
  .min(2)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens.",
  );
type ContentPage = {
  id: string;
  slug: string;
  title: string;
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ownerReviewDue: boolean;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
  updatedAt: string;
};
const pageSchema = z.object({
  slug,
  title: z.string().min(2).max(220),
  contentHtml: z.string().min(10),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(170),
  ownerReviewDue: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string(),
  isDemo: z.boolean(),
});
type PageForm = z.infer<typeof pageSchema>;
const blankPage: PageForm = {
  slug: "",
  title: "",
  contentHtml: "<p></p>",
  seoTitle: "",
  seoDescription: "",
  ownerReviewDue: true,
  status: "DRAFT",
  publishedAt: "",
  isDemo: false,
};

export function ContentPagesPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState<ContentPage | null>(null);
  const form = useForm<PageForm>({
    resolver: zodResolver(pageSchema),
    defaultValues: blankPage,
  });
  useUnsavedChanges(form.formState.isDirty);
  const pages = useQuery({
    queryKey: ["content-pages"],
    queryFn: () => apiRequest<DataResponse<ContentPage[]>>("/admin/pages"),
  });
  const save = useMutation({
    mutationFn: (value: PageForm) =>
      apiRequest<DataResponse<ContentPage>>(
        editing ? `/admin/pages/${editing.id}` : "/admin/pages",
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: {
            ...value,
            seoTitle: value.seoTitle || null,
            seoDescription: value.seoDescription || null,
            publishedAt: value.publishedAt
              ? new Date(value.publishedAt).toISOString()
              : null,
          },
        },
      ),
    onSuccess: async () => {
      notify(
        `Page ${editing ? "updated" : "created"}; rich text was sanitised server-side.`,
      );
      setEditing(null);
      form.reset(blankPage);
      await client.invalidateQueries({ queryKey: ["content-pages"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/pages/${id}`, { method: "DELETE", csrfToken }),
    onSuccess: async () => {
      notify("Page archived.");
      await client.invalidateQueries({ queryKey: ["content-pages"] });
    },
  });
  const edit = (item: ContentPage) => {
    setEditing(item);
    form.reset({
      slug: item.slug,
      title: item.title,
      contentHtml: item.contentHtml,
      seoTitle: item.seoTitle ?? "",
      seoDescription: item.seoDescription ?? "",
      ownerReviewDue: item.ownerReviewDue,
      status: item.status,
      publishedAt: item.publishedAt?.slice(0, 16) ?? "",
      isDemo: item.isDemo,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Website content"
        title="Pages and policies"
        description="Manage About, Contact, privacy, terms, cancellation and other sanitised content pages."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(blankPage);
            }}
          >
            New page
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card className="overflow-hidden p-0!">
          {pages.isPending ? (
            <LoadingPanel />
          ) : pages.isError ? (
            <ErrorPanel
              error={pages.error}
              retry={() => void pages.refetch()}
            />
          ) : pages.data.data.length === 0 ? (
            <EmptyState
              title="No content pages"
              description="Create an owner-review draft before publishing."
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Status</th>
                    <th>Review</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.title}</span>
                        <small>/{item.slug}</small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>
                        {item.ownerReviewDue ? "Owner review due" : "Reviewed"}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => edit(item)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              question={`Archive ${item.title}?`}
                              onClick={() => archive.mutate(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{editing ? "Editing page" : "New page"}</p>
          <h2>{editing?.title ?? "Create page"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={form.handleSubmit((value) => save.mutate(value))}
          >
            <label>
              Title
              <input {...form.register("title")} />
            </label>
            <label>
              URL slug
              <input {...form.register("slug")} />
            </label>
            <label>
              Safe HTML content
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                Allowed formatting is sanitised again by Express.
              </span>
              <textarea
                className="min-h-48 font-mono text-xs"
                {...form.register("contentHtml")}
              />
            </label>
            <label>
              SEO title
              <input {...form.register("seoTitle")} />
            </label>
            <label>
              SEO description
              <textarea rows={3} {...form.register("seoDescription")} />
            </label>
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Status
                <select {...form.register("status")}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
              <label>
                Publish date
                <input
                  type="datetime-local"
                  {...form.register("publishedAt")}
                />
              </label>
            </div>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("ownerReviewDue")} />{" "}
              Owner review is still due
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Demo
              content
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button disabled={save.isPending} type="submit">
                Save page
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null);
                    form.reset(blankPage);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

const sectionTypes = [
  "HERO",
  "DISCOVERY",
  "FEATURED_PACKAGES",
  "CATEGORIES",
  "DESTINATIONS",
  "INTRODUCTION",
  "PLANNING_PROCESS",
  "GALLERY",
  "TESTIMONIALS",
  "LATEST_BLOG",
  "FAQS",
  "CONTACT_CTA",
] as const;
type HomeSection = {
  id: string;
  type: (typeof sectionTypes)[number];
  title: string | null;
  content: unknown;
  isVisible: boolean;
  sortOrder: number;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
};
const homeSchema = z.object({
  type: z.enum(sectionTypes),
  title: z.string().max(220),
  contentJson: z.string().min(2),
  isVisible: z.boolean(),
  sortOrder: z.string().regex(/^\d+$/),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string(),
  isDemo: z.boolean(),
});
type HomeForm = z.infer<typeof homeSchema>;
const blankHome: HomeForm = {
  type: "HERO",
  title: "",
  contentJson: "{}",
  isVisible: true,
  sortOrder: "0",
  status: "DRAFT",
  publishedAt: "",
  isDemo: false,
};
export function HomepageSectionsPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const form = useForm<HomeForm>({
    resolver: zodResolver(homeSchema),
    defaultValues: blankHome,
  });
  useUnsavedChanges(form.formState.isDirty);
  const sections = useQuery({
    queryKey: ["home-sections"],
    queryFn: () =>
      apiRequest<DataResponse<HomeSection[]>>("/admin/home/sections"),
  });
  const save = useMutation({
    mutationFn: (value: HomeForm) => {
      let content: unknown;
      try {
        content = JSON.parse(value.contentJson);
      } catch {
        throw new Error("Section content must be valid JSON.");
      }
      return apiRequest<DataResponse<HomeSection>>(
        editing ? `/admin/home/sections/${editing.id}` : "/admin/home/sections",
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: {
            ...value,
            title: value.title || null,
            content,
            sortOrder: Number(value.sortOrder),
            publishedAt: value.publishedAt
              ? new Date(value.publishedAt).toISOString()
              : null,
            contentJson: undefined,
          },
        },
      );
    },
    onSuccess: async () => {
      notify("Homepage section saved. Public order updates without a rebuild.");
      setEditing(null);
      form.reset(blankHome);
      await client.invalidateQueries({ queryKey: ["home-sections"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/home/sections/${id}`, {
        method: "DELETE",
        csrfToken,
      }),
    onSuccess: async () => {
      notify("Homepage section archived and hidden.");
      await client.invalidateQueries({ queryKey: ["home-sections"] });
    },
  });
  const edit = (item: HomeSection) => {
    setEditing(item);
    form.reset({
      type: item.type,
      title: item.title ?? "",
      contentJson: JSON.stringify(item.content, null, 2),
      isVisible: item.isVisible,
      sortOrder: String(item.sortOrder),
      status: item.status,
      publishedAt: item.publishedAt?.slice(0, 16) ?? "",
      isDemo: item.isDemo,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="Homepage"
        title="Finite homepage sections"
        description="Only supported section types can be configured; this is not an arbitrary-code page builder."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(blankHome);
            }}
          >
            Add section
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card className="overflow-hidden p-0!">
          {sections.isPending ? (
            <LoadingPanel />
          ) : sections.isError ? (
            <ErrorPanel
              error={sections.error}
              retry={() => void sections.refetch()}
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Section</th>
                    <th>Status</th>
                    <th>Visible</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sortOrder}</td>
                      <td>
                        <span className="font-bold text-admin-brand-deep">
                          {item.title || item.type.replaceAll("_", " ")}
                        </span>
                        <small>{item.type}</small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>{item.isVisible ? "Yes" : "No"}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => edit(item)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              question="Archive and hide this section?"
                              onClick={() => archive.mutate(item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <h2>{editing ? "Edit section" : "Add section"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={form.handleSubmit((value) => save.mutate(value))}
          >
            <label>
              Section type
              <select {...form.register("type")}>
                {sectionTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Heading
              <input {...form.register("title")} />
            </label>
            <label>
              Typed content JSON
              <textarea
                className="min-h-48 font-mono text-xs"
                {...form.register("contentJson")}
              />
            </label>
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Display order
                <input inputMode="numeric" {...form.register("sortOrder")} />
              </label>
              <label>
                Status
                <select {...form.register("status")}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
            </div>
            <label>
              Publish date
              <input type="datetime-local" {...form.register("publishedAt")} />
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isVisible")} /> Visible
              when published
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Demo
              content
            </label>
            <Button disabled={save.isPending} type="submit">
              Save section
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

type NavigationMenu = {
  id: string;
  key: string;
  label: string;
  items: Array<{
    id: string;
    parentId: string | null;
    label: string;
    href: string;
    sortOrder: number;
    isVisible: boolean;
  }>;
};
function menuLines(menu: NavigationMenu) {
  const keys = new Map(
    menu.items.map((item, index) => [item.id, `item-${index + 1}`]),
  );
  return menu.items
    .map(
      (item) =>
        `${keys.get(item.id)}|${item.parentId ? (keys.get(item.parentId) ?? "") : ""}|${item.label}|${item.href}|${item.sortOrder}|${item.isVisible}`,
    )
    .join("\n");
}
export function NavigationPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [itemsText, setItemsText] = useState("");
  const menus = useQuery({
    queryKey: ["navigation"],
    queryFn: () =>
      apiRequest<DataResponse<NavigationMenu[]>>("/admin/navigation"),
  });
  const selectMenu = (menu: NavigationMenu) => {
    setKey(menu.key);
    setLabel(menu.label);
    setItemsText(menuLines(menu));
  };
  const save = useMutation({
    mutationFn: () =>
      apiRequest<DataResponse<NavigationMenu>>(
        `/admin/navigation/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          csrfToken,
          body: { label, items: parseMenuLines(itemsText) },
        },
      ),
    onSuccess: async () => {
      notify("Navigation hierarchy saved.");
      await client.invalidateQueries({ queryKey: ["navigation"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  return (
    <>
      <PageHeader
        eyebrow="Website navigation"
        title="Menus and footer links"
        description="Safe relative, HTTPS, mailto and tel links are validated by the API. Navigation supports two levels."
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card>
          <h2>Saved menus</h2>
          <div className="grid [&_a]:flex [&_a]:items-center [&_a]:justify-between [&_a]:border-t [&_a]:border-admin-border-soft [&_a]:py-4 [&_a]:font-bold [&_a]:no-underline [&_a:hover]:text-admin-accent [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:border-0 [&_button]:border-t [&_button]:border-admin-border-soft [&_button]:bg-transparent [&_button]:py-4 [&_button]:text-left [&_button]:font-bold [&_button]:text-admin-ink">
            {menus.data?.data.map((menu) => (
              <button
                className={menu.key === key ? "text-admin-accent!" : ""}
                key={menu.id}
                onClick={() => selectMenu(menu)}
              >
                {menu.label}
                <span>{menu.items.length} links</span>
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setKey("footer");
              setLabel("Footer navigation");
              setItemsText("");
            }}
          >
            Configure footer menu
          </Button>
        </Card>
        <Card>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label>
              Menu key
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
            <label>
              Menu label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label>
              Menu items
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                One line: key | parent key | label | href | order | true/false
              </span>
              <textarea
                className="min-h-48 font-mono text-xs"
                value={itemsText}
                onChange={(event) => setItemsText(event.target.value)}
                placeholder="tours||Tours|/packages|0|true&#10;domestic|tours|Domestic|/packages?category=domestic|1|true"
              />
            </label>
            <Button disabled={!key || save.isPending} type="submit">
              Save menu
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

type Setting = {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
};
export function SettingsPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<DataResponse<Setting[]>>("/admin/settings"),
  });
  const save = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("Setting value must be valid JSON.");
      }
      return apiRequest<DataResponse<Setting>>(
        `/admin/settings/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          csrfToken,
          body: { value: parsed, isPublic, description: description || null },
        },
      );
    },
    onSuccess: async () => {
      notify(
        "Setting saved. Secret-like keys remain blocked from public exposure.",
      );
      await client.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const edit = (item: Setting) => {
    setKey(item.key);
    setValue(JSON.stringify(item.value, null, 2));
    setDescription(item.description ?? "");
    setIsPublic(item.isPublic);
  };
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Public settings"
        description="Company contact, social, WhatsApp, SEO and other JSON settings. Secret-like keys cannot be public."
      />
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card className="overflow-hidden p-0!">
          {settings.isPending ? (
            <LoadingPanel />
          ) : settings.isError ? (
            <ErrorPanel
              error={settings.error}
              retry={() => void settings.refetch()}
            />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Exposure</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.data.data.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.key}</span>
                        <small>{item.description}</small>
                      </td>
                      <td>
                        <StatusBadge
                          value={item.isPublic ? "PUBLIC" : "PRIVATE"}
                        />
                      </td>
                      <td>
                        <Button variant="secondary" onClick={() => edit(item)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <h2>Set configuration value</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label>
              Key
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="company.contact"
              />
            </label>
            <label>
              JSON value
              <textarea
                className="min-h-48 font-mono text-xs"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <label>
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                type="checkbox"
              />{" "}
              Expose through the public site settings API
            </label>
            <Button disabled={!key || save.isPending} type="submit">
              Save setting
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

type Faq = {
  id: string;
  packageId: string | null;
  question: string;
  answer: string;
  sortOrder: number;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
};
type Testimonial = {
  id: string;
  publicName: string;
  quote: string;
  consentNotes: string | null;
  approved: boolean;
  sortOrder: number;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
};
export function EngagementPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [mode, setMode] = useState<"faqs" | "testimonials">("faqs");
  const [faq, setFaq] = useState<Partial<Faq>>({
    question: "",
    answer: "",
    sortOrder: 0,
    status: "DRAFT",
    isDemo: false,
    packageId: null,
  });
  const [testimonial, setTestimonial] = useState<Partial<Testimonial>>({
    publicName: "",
    quote: "",
    consentNotes: "",
    approved: false,
    sortOrder: 0,
    status: "DRAFT",
    isDemo: false,
  });
  const faqs = useQuery({
    queryKey: ["faqs"],
    queryFn: () => apiRequest<DataResponse<Faq[]>>("/admin/faqs"),
  });
  const testimonials = useQuery({
    queryKey: ["testimonials"],
    queryFn: () =>
      apiRequest<DataResponse<Testimonial[]>>("/admin/testimonials"),
  });
  const packages = useQuery({
    queryKey: ["packages-for-relations"],
    queryFn: () =>
      apiRequest<PageResponse<PackageRecord>>("/admin/packages?pageSize=100"),
  });
  const saveFaq = useMutation({
    mutationFn: () =>
      apiRequest<DataResponse<Faq>>(
        faq.id ? `/admin/faqs/${faq.id}` : "/admin/faqs",
        {
          method: faq.id ? "PUT" : "POST",
          csrfToken,
          body: {
            packageId: faq.packageId || null,
            question: faq.question,
            answer: faq.answer,
            sortOrder: Number(faq.sortOrder ?? 0),
            status: faq.status ?? "DRAFT",
            publishedAt: faq.publishedAt ?? null,
            isDemo: Boolean(faq.isDemo),
          },
        },
      ),
    onSuccess: async () => {
      notify("FAQ saved.");
      setFaq({
        question: "",
        answer: "",
        sortOrder: 0,
        status: "DRAFT",
        isDemo: false,
        packageId: null,
      });
      await client.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const saveTestimonial = useMutation({
    mutationFn: () =>
      apiRequest<DataResponse<Testimonial>>(
        testimonial.id
          ? `/admin/testimonials/${testimonial.id}`
          : "/admin/testimonials",
        {
          method: testimonial.id ? "PUT" : "POST",
          csrfToken,
          body: {
            publicName: testimonial.publicName,
            quote: testimonial.quote,
            consentNotes: testimonial.consentNotes || null,
            approved: Boolean(testimonial.approved),
            sortOrder: Number(testimonial.sortOrder ?? 0),
            status: testimonial.status ?? "DRAFT",
            publishedAt: testimonial.publishedAt ?? null,
            isDemo: Boolean(testimonial.isDemo),
          },
        },
      ),
    onSuccess: async () => {
      notify("Testimonial saved with approval and consent rules enforced.");
      setTestimonial({
        publicName: "",
        quote: "",
        consentNotes: "",
        approved: false,
        sortOrder: 0,
        status: "DRAFT",
        isDemo: false,
      });
      await client.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = async (resource: "faqs" | "testimonials", id: string) => {
    await apiRequest<void>(`/admin/${resource}/${id}`, {
      method: "DELETE",
      csrfToken,
    });
    notify(`${resource === "faqs" ? "FAQ" : "Testimonial"} archived.`);
    await client.invalidateQueries({ queryKey: [resource] });
  };
  return (
    <>
      <PageHeader
        eyebrow="Trust and answers"
        title="FAQs and testimonials"
        description="Package-specific FAQs are supported. Testimonials stay private until genuine consent is recorded and approval is explicit."
      />
      <div className="mb-3 flex gap-1.5 overflow-x-auto p-1 [&_button]:whitespace-nowrap [&_button]:rounded-full [&_button]:border [&_button]:border-admin-border [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2 [&_button]:text-[0.72rem] [&_button]:font-bold [&_button]:text-admin-ink-muted">
        <button
          className={
            mode === "faqs"
              ? "border-admin-brand! bg-admin-brand! text-white!"
              : ""
          }
          onClick={() => setMode("faqs")}
        >
          FAQs
        </button>
        <button
          className={
            mode === "testimonials"
              ? "border-admin-brand! bg-admin-brand! text-white!"
              : ""
          }
          onClick={() => setMode("testimonials")}
        >
          Testimonials
        </button>
      </div>
      {mode === "faqs" ? (
        <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
          <Card className="overflow-hidden p-0!">
            {faqs.isPending ? (
              <LoadingPanel />
            ) : (
              <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
                <table>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Status</th>
                      <th>Package</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faqs.data?.data.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold text-admin-brand-deep">{item.question}</td>
                        <td>
                          <StatusBadge value={item.status} />
                        </td>
                        <td>
                          {packages.data?.data.find(
                            (record) => record.id === item.packageId,
                          )?.title ?? "Global"}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                            <Button
                              variant="secondary"
                              onClick={() => setFaq(item)}
                            >
                              Edit
                            </Button>
                            <ConfirmButton
                              question="Archive this FAQ?"
                              onClick={() => void archive("faqs", item.id)}
                            >
                              Archive
                            </ConfirmButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h2>{faq.id ? "Edit FAQ" : "Add FAQ"}</h2>
            <div className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Package
                <select
                  value={faq.packageId ?? ""}
                  onChange={(event) =>
                    setFaq((value) => ({
                      ...value,
                      packageId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Global FAQ</option>
                  {packages.data?.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Question
                <input
                  value={faq.question ?? ""}
                  onChange={(event) =>
                    setFaq((value) => ({
                      ...value,
                      question: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Answer
                <textarea
                  value={faq.answer ?? ""}
                  onChange={(event) =>
                    setFaq((value) => ({
                      ...value,
                      answer: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={faq.status}
                  onChange={(event) =>
                    setFaq((value) => ({
                      ...value,
                      status: event.target.value as PublicationStatus,
                    }))
                  }
                >
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
              <Button
                disabled={saveFaq.isPending}
                onClick={() => saveFaq.mutate()}
              >
                Save FAQ
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)] items-start gap-4 max-[900px]:grid-cols-1">
          <Card className="overflow-hidden p-0!">
            {testimonials.isPending ? (
              <LoadingPanel />
            ) : (
              <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
                <table>
                  <thead>
                    <tr>
                      <th>Public name</th>
                      <th>Status</th>
                      <th>Approval</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testimonials.data?.data.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="font-bold text-admin-brand-deep">{item.publicName}</span>
                          <small>{item.quote.slice(0, 80)}</small>
                        </td>
                        <td>
                          <StatusBadge value={item.status} />
                        </td>
                        <td>
                          {item.approved ? (
                            <StatusBadge value="APPROVED" />
                          ) : (
                            "Not approved"
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                            <Button
                              variant="secondary"
                              onClick={() => setTestimonial(item)}
                            >
                              Edit
                            </Button>
                            <ConfirmButton
                              question="Archive this testimonial?"
                              onClick={() =>
                                void archive("testimonials", item.id)
                              }
                            >
                              Archive
                            </ConfirmButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h2>{testimonial.id ? "Edit testimonial" : "Add testimonial"}</h2>
            <div className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Public name
                <input
                  value={testimonial.publicName ?? ""}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      publicName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Quote
                <textarea
                  value={testimonial.quote ?? ""}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      quote: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Consent evidence / notes
                <textarea
                  value={testimonial.consentNotes ?? ""}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      consentNotes: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={testimonial.status}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      status: event.target.value as PublicationStatus,
                    }))
                  }
                >
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
              <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
                <input
                  checked={Boolean(testimonial.approved)}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      approved: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />{" "}
                Approved for public display
              </label>
              <Button
                disabled={saveTestimonial.isPending}
                onClick={() => saveTestimonial.mutate()}
              >
                Save testimonial
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

type BlogCategory = {
  id: string;
  slug: string;
  name: string;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
};
type BlogTag = { id: string; slug: string; name: string };
type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  categoryId: string | null;
  coverMediaId: string | null;
  publicAuthorName: string | null;
  publicAuthorBio: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
  tags: Array<{ tag: BlogTag }>;
  relatedTours: Array<{ package: { id: string; title: string } }>;
  relatedArticles: Array<{
    relatedPost: {
      id: string;
      slug: string;
      title: string;
      status: PublicationStatus;
    };
  }>;
  updatedAt: string;
};
const blogSchema = z.object({
  slug,
  title: z.string().min(2),
  excerpt: z.string().min(10).max(500),
  contentHtml: z.string().min(10),
  categoryId: z.string(),
  coverMediaId: z.string(),
  publicAuthorName: z.string().max(120),
  publicAuthorBio: z.string().max(1000),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(170),
  tagIds: z.array(z.string()),
  relatedPackageIds: z.array(z.string()),
  relatedPostIds: z.array(z.string()).max(12),
  isFeatured: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string(),
  isDemo: z.boolean(),
});
type BlogForm = z.infer<typeof blogSchema>;
const blankBlog: BlogForm = {
  slug: "",
  title: "",
  excerpt: "",
  contentHtml: "<p></p>",
  categoryId: "",
  coverMediaId: "",
  publicAuthorName: "",
  publicAuthorBio: "",
  seoTitle: "",
  seoDescription: "",
  tagIds: [],
  relatedPackageIds: [],
  relatedPostIds: [],
  isFeatured: false,
  status: "DRAFT",
  publishedAt: "",
  isDemo: false,
};
export function BlogPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [preview, setPreview] = useState<BlogPost | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", slug: "" });
  const [tagDraft, setTagDraft] = useState({ name: "", slug: "" });
  const form = useForm<BlogForm>({
    resolver: zodResolver(blogSchema),
    defaultValues: blankBlog,
  });
  useUnsavedChanges(form.formState.isDirty);
  const posts = useQuery({
    queryKey: ["blog-posts"],
    queryFn: () => apiRequest<DataResponse<BlogPost[]>>("/admin/blog/posts"),
  });
  const categories = useQuery({
    queryKey: ["blog-categories"],
    queryFn: () =>
      apiRequest<DataResponse<BlogCategory[]>>("/admin/blog/categories"),
  });
  const tags = useQuery({
    queryKey: ["blog-tags"],
    queryFn: () => apiRequest<DataResponse<BlogTag[]>>("/admin/blog/tags"),
  });
  const packages = useQuery({
    queryKey: ["packages-for-relations"],
    queryFn: () =>
      apiRequest<PageResponse<PackageRecord>>("/admin/packages?pageSize=100"),
  });
  const media = useQuery({
    queryKey: ["media-library", "blog"],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>("/admin/media?pageSize=100"),
  });
  const save = useMutation({
    mutationFn: (value: BlogForm) =>
      apiRequest<DataResponse<BlogPost>>(
        editing ? `/admin/blog/posts/${editing.id}` : "/admin/blog/posts",
        {
          method: editing ? "PUT" : "POST",
          csrfToken,
          body: {
            ...value,
            categoryId: value.categoryId || null,
            coverMediaId: value.coverMediaId || null,
            publicAuthorName: value.publicAuthorName || null,
            publicAuthorBio: value.publicAuthorBio || null,
            seoTitle: value.seoTitle || null,
            seoDescription: value.seoDescription || null,
            publishedAt: value.publishedAt
              ? new Date(value.publishedAt).toISOString()
              : null,
          },
        },
      ),
    onSuccess: async (result) => {
      notify("Article saved and rich text sanitised server-side.");
      setEditing(result.data);
      form.reset({ ...form.getValues() });
      await client.invalidateQueries({ queryKey: ["blog-posts"] });
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/blog/posts/${id}`, {
        method: "DELETE",
        csrfToken,
      }),
    onSuccess: async () => {
      notify("Article archived.");
      await client.invalidateQueries({ queryKey: ["blog-posts"] });
    },
  });
  const createTaxonomy = async (kind: "categories" | "tags") => {
    const draft = kind === "categories" ? categoryDraft : tagDraft;
    await apiRequest(`/admin/blog/${kind}`, {
      method: "POST",
      csrfToken,
      body:
        kind === "categories"
          ? { ...draft, status: "PUBLISHED", publishedAt: null, isDemo: false }
          : draft,
    });
    if (kind === "categories") setCategoryDraft({ name: "", slug: "" });
    else setTagDraft({ name: "", slug: "" });
    notify(`${kind === "categories" ? "Category" : "Tag"} created.`);
    await client.invalidateQueries({ queryKey: [`blog-${kind}`] });
  };
  const edit = (item: BlogPost) => {
    setEditing(item);
    form.reset({
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      contentHtml: item.contentHtml,
      categoryId: item.categoryId ?? "",
      coverMediaId: item.coverMediaId ?? "",
      publicAuthorName: item.publicAuthorName ?? "",
      publicAuthorBio: item.publicAuthorBio ?? "",
      seoTitle: item.seoTitle ?? "",
      seoDescription: item.seoDescription ?? "",
      tagIds: item.tags.map((relation) => relation.tag.id),
      relatedPackageIds: item.relatedTours.map(
        (relation) => relation.package.id,
      ),
      relatedPostIds: item.relatedArticles.map(
        (relation) => relation.relatedPost.id,
      ),
      isFeatured: item.isFeatured,
      status: item.status,
      publishedAt: item.publishedAt?.slice(0, 16) ?? "",
      isDemo: item.isDemo,
    });
  };
  const multi = (
    field: "tagIds" | "relatedPackageIds" | "relatedPostIds",
    options: Array<{ id: string; label: string }>,
  ) => (
    <select
      multiple
      value={form.watch(field)}
      onChange={(event) =>
        form.setValue(
          field,
          Array.from(
            event.currentTarget.selectedOptions,
            (option) => option.value,
          ),
          { shouldDirty: true },
        )
      }
    >
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
  const cover = preview?.coverMediaId
    ? media.data?.data.find((item) => item.id === preview.coverMediaId)
    : null;
  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Blog publishing"
        description="Drafts stay private. Stored HTML is sanitised by Express and reading time is calculated from content."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(blankBlog);
            }}
          >
            New article
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.5fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <Card className="overflow-hidden p-0!">
          {posts.isPending ? (
            <LoadingPanel />
          ) : (
            <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.data?.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-bold text-admin-brand-deep">{item.title}</span>
                        <small>/{item.slug}</small>
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-8 [&>a]:px-2.5 [&>a]:py-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => edit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setPreview(item)}
                          >
                            Preview
                          </Button>
                          <ConfirmButton
                            question="Archive this article?"
                            onClick={() => archive.mutate(item.id)}
                          >
                            Archive
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="min-w-0">
          <h2>{editing ? "Edit article" : "Create article"}</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={form.handleSubmit((value) => save.mutate(value))}
          >
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Title
                <input {...form.register("title")} />
              </label>
              <label>
                URL slug
                <input {...form.register("slug")} />
              </label>
            </div>
            <label>
              Excerpt
              <textarea rows={3} {...form.register("excerpt")} />
            </label>
            <label>
              Sanitised HTML editor
              <textarea
                className="min-h-[22rem] font-mono text-xs"
                {...form.register("contentHtml")}
              />
            </label>
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Category
                <select {...form.register("categoryId")}>
                  <option value="">Uncategorised</option>
                  {categories.data?.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cover media
                <select {...form.register("coverMediaId")}>
                  <option value="">No cover</option>
                  {media.data?.data
                    .filter((item) => item.mimeType.startsWith("image/"))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.altText}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Tags
                <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                  Hold Ctrl/Command for multiple.
                </span>
                {multi(
                  "tagIds",
                  tags.data?.data.map((item) => ({
                    id: item.id,
                    label: item.name,
                  })) ?? [],
                )}
              </label>
              <label>
                Related packages
                {multi(
                  "relatedPackageIds",
                  packages.data?.data.map((item) => ({
                    id: item.id,
                    label: item.title,
                  })) ?? [],
                )}
              </label>
              <label>
                Related articles
                <span className="text-[0.68rem] font-normal text-admin-ink-subtle">
                  Up to 12; the current article is excluded.
                </span>
                {multi(
                  "relatedPostIds",
                  posts.data?.data
                    .filter(
                      (item) =>
                        item.id !== editing?.id && item.status !== "ARCHIVED",
                    )
                    .map((item) => ({ id: item.id, label: item.title })) ?? [],
                )}
              </label>
              <label>
                Status
                <select {...form.register("status")}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </select>
              </label>
              <label>
                Publish date
                <input
                  type="datetime-local"
                  {...form.register("publishedAt")}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Public author name
                <input maxLength={120} {...form.register("publicAuthorName")} />
              </label>
              <label>
                Public author bio
                <textarea
                  maxLength={1000}
                  rows={3}
                  {...form.register("publicAuthorBio")}
                />
              </label>
              <label>
                SEO title
                <input maxLength={70} {...form.register("seoTitle")} />
              </label>
              <label>
                SEO description
                <textarea
                  maxLength={170}
                  rows={3}
                  {...form.register("seoDescription")}
                />
              </label>
            </div>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isFeatured")} />{" "}
              Featured article
            </label>
            <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
              <input type="checkbox" {...form.register("isDemo")} /> Demo
              content
            </label>
            <Button disabled={save.isPending} type="submit">
              Save article
            </Button>
          </form>
          <div className="mt-6 grid gap-2.5 border-t border-admin-border-soft pt-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft [&>div]:grid [&>div]:grid-cols-[1fr_1fr_auto] [&>div]:gap-2 max-[680px]:[&>div]:grid-cols-1">
            <h3>Quick-create taxonomy</h3>
            <div>
              <input
                placeholder="Category name"
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
              />
              <input
                placeholder="category-slug"
                value={categoryDraft.slug}
                onChange={(event) =>
                  setCategoryDraft((value) => ({
                    ...value,
                    slug: event.target.value,
                  }))
                }
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void createTaxonomy("categories")}
              >
                Add category
              </Button>
            </div>
            <div>
              <input
                placeholder="Tag name"
                value={tagDraft.name}
                onChange={(event) =>
                  setTagDraft((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
              />
              <input
                placeholder="tag-slug"
                value={tagDraft.slug}
                onChange={(event) =>
                  setTagDraft((value) => ({
                    ...value,
                    slug: event.target.value,
                  }))
                }
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void createTaxonomy("tags")}
              >
                Add tag
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {preview ? (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-admin-overlay p-4">
          <article
            aria-modal="true"
            className="max-h-[calc(100vh-2rem)] w-full max-w-[52rem] overflow-y-auto rounded-[0.9rem] bg-admin-surface p-[clamp(1.25rem,4vw,2rem)] shadow-admin-dialog [&>img]:mb-5 [&>img]:aspect-[16/7] [&>img]:w-full [&>img]:rounded-[0.65rem] [&>img]:object-cover"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start [&_p]:mb-0 [&_p]:text-admin-ink-muted">
              <div>
                <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">Protected article preview</p>
                <h2>{preview.title}</h2>
              </div>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
            {cover ? (
              <img src={privateMediaUrl(cover.id)} alt={cover.altText} />
            ) : null}
            <p className="text-[1.05rem] italic leading-relaxed text-admin-ink-muted">{preview.excerpt}</p>
            <div
              className="leading-[1.75] text-admin-ink [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: preview.contentHtml }}
            />
          </article>
        </div>
      ) : null}
    </>
  );
}
