/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  apiRequest,
  privateMediaUrl,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import { SeoFields } from "../components/SeoFields";
import { SocialLinksForm } from "../components/SocialLinksForm";
import { parseMenuLines } from "../lib/navigation";
import type { MediaAsset, PackageSummary, PublicationStatus } from "../types";
import {
  ActionLink,
  BackLink,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  StickyActionBar,
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
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
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
            seoTitle: value.seoTitle.trim() || null,
            seoDescription: value.seoDescription.trim() || null,
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
      navigate("/content/pages");
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
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        form.reset(blankPage);
        return;
      }
      const record = pages.data?.data.find((item) => item.id === id);
      if (!record) return;
      setEditing(record);
      form.reset({
        slug: record.slug,
        title: record.title,
        contentHtml: record.contentHtml,
        seoTitle: record.seoTitle ?? "",
        seoDescription: record.seoDescription ?? "",
        ownerReviewDue: record.ownerReviewDue,
        status: record.status,
        publishedAt: record.publishedAt?.slice(0, 16) ?? "",
        isDemo: record.isDemo,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, form, id, pages.data]);
  return (
    <>
      <PageHeader
        eyebrow="Website content"
        title={editorOpen ? (editing ? "Edit content page" : "New content page") : "Pages and policies"}
        description="Manage About, Contact, privacy, terms, cancellation and other sanitised content pages."
        actions={
          editorOpen ? (
            <BackLink to="/content/pages" />
          ) : (
            <ActionLink to="/content/pages/new">New page</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
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
                            onClick={() => navigate(`/content/pages/${item.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              confirmText="Archive page"
                              dialogDescription="This page will be removed from the public site and retained in archived records."
                              dialogTitle="Archive page or policy?"
                              detailText={item.title}
                              onConfirm={() => archive.mutateAsync(item.id)}
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
        ) : null}
        {editorOpen ? id && pages.isError ? (
          <ErrorPanel error={pages.error} retry={() => void pages.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label="Loading content page…" />
        ) : (
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
            <SeoFields
              titleField={form.register("seoTitle")}
              descriptionField={form.register("seoDescription")}
              titleValue={form.watch("seoTitle")}
              descriptionValue={form.watch("seoDescription")}
              fallbackTitle={form.watch("title")}
              titleError={form.formState.errors.seoTitle?.message}
              descriptionError={form.formState.errors.seoDescription?.message}
            />
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
            <StickyActionBar dirty={form.formState.isDirty} saving={save.isPending}>
              {form.formState.isDirty ? (
                <ConfirmButton
                  cancelText="Keep editing"
                  confirmText="Discard changes"
                  dialogDescription="All unsaved page copy, SEO and publishing edits will be reverted."
                  dialogTitle="Discard page changes?"
                  onConfirm={() =>
                    form.reset(
                      editing
                        ? {
                            slug: editing.slug,
                            title: editing.title,
                            contentHtml: editing.contentHtml,
                            seoTitle: editing.seoTitle ?? "",
                            seoDescription: editing.seoDescription ?? "",
                            ownerReviewDue: editing.ownerReviewDue,
                            status: editing.status,
                            publishedAt: editing.publishedAt?.slice(0, 16) ?? "",
                            isDemo: editing.isDemo,
                          }
                        : blankPage,
                    )
                  }
                  tone="warning"
                >Discard</ConfirmButton>
              ) : null}
              <Button disabled={save.isPending} onClick={() => { form.setValue("status", "DRAFT", { shouldDirty: true }); void form.handleSubmit((value) => save.mutate(value))(); }} type="button" variant="secondary">Save as draft</Button>
              <Button disabled={save.isPending || !form.formState.isDirty} type="submit">{form.watch("status") === "PUBLISHED" ? "Publish changes" : "Save page"}</Button>
            </StickyActionBar>
          </form>
        </Card>
        ) : null}
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
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
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
      navigate("/content/home");
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
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        form.reset(blankHome);
        return;
      }
      const record = sections.data?.data.find((item) => item.id === id);
      if (!record) return;
      setEditing(record);
      form.reset({
        type: record.type,
        title: record.title ?? "",
        contentJson: JSON.stringify(record.content, null, 2),
        isVisible: record.isVisible,
        sortOrder: String(record.sortOrder),
        status: record.status,
        publishedAt: record.publishedAt?.slice(0, 16) ?? "",
        isDemo: record.isDemo,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, form, id, sections.data]);
  return (
    <>
      <PageHeader
        eyebrow="Homepage"
        title={editorOpen ? (editing ? "Edit homepage section" : "New homepage section") : "Homepage sections"}
        description="Only supported section types can be configured; this is not an arbitrary-code page builder."
        actions={
          editorOpen ? (
            <BackLink to="/content/home" />
          ) : (
            <ActionLink to="/content/home/new">Add section</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
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
                            onClick={() => navigate(`/content/home/${item.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {item.status !== "ARCHIVED" ? (
                            <ConfirmButton
                              confirmText="Archive section"
                              dialogDescription="This section will be hidden from the homepage after the change is saved by the API."
                              dialogTitle="Archive homepage section?"
                              detailText={item.title}
                              onConfirm={() => archive.mutateAsync(item.id)}
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
        ) : null}
        {editorOpen ? id && sections.isError ? (
          <ErrorPanel error={sections.error} retry={() => void sections.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label="Loading homepage section…" />
        ) : (
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
        ) : null}
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
  const navigate = useNavigate();
  const location = useLocation();
  const { key: routeKey } = useParams();
  const editorOpen = Boolean(routeKey) || location.pathname.endsWith("/new");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [itemsText, setItemsText] = useState("");
  const menus = useQuery({
    queryKey: ["navigation"],
    queryFn: () =>
      apiRequest<DataResponse<NavigationMenu[]>>("/admin/navigation"),
  });
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
      navigate("/content/navigation");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!routeKey) {
        setKey("");
        setLabel("");
        setItemsText("");
        return;
      }
      const record = menus.data?.data.find((menu) => menu.key === routeKey);
      if (!record) return;
      setKey(record.key);
      setLabel(record.label);
      setItemsText(menuLines(record));
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, menus.data, routeKey]);
  return (
    <>
      <PageHeader
        eyebrow="Website navigation"
        title={editorOpen ? (routeKey ? "Edit navigation menu" : "New navigation menu") : "Menus and footer links"}
        description="Safe relative, HTTPS, mailto and tel links are validated by the API. Navigation supports two levels."
        actions={
          editorOpen ? (
            <BackLink to="/content/navigation" />
          ) : (
            <ActionLink to="/content/navigation/new">New menu</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
        <Card>
          <h2>Saved menus</h2>
          <div className="grid [&_a]:flex [&_a]:items-center [&_a]:justify-between [&_a]:border-t [&_a]:border-admin-border-soft [&_a]:py-4 [&_a]:font-bold [&_a]:no-underline [&_a:hover]:text-admin-accent [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:border-0 [&_button]:border-t [&_button]:border-admin-border-soft [&_button]:bg-transparent [&_button]:py-4 [&_button]:text-left [&_button]:font-bold [&_button]:text-admin-ink">
            {menus.data?.data.map((menu) => (
              <button
                className={menu.key === key ? "text-admin-accent!" : ""}
                key={menu.id}
                onClick={() => navigate(`/content/navigation/${encodeURIComponent(menu.key)}/edit`)}
              >
                {menu.label}
                <span>{menu.items.length} links</span>
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate("/content/navigation/new")}
          >
            Create another menu
          </Button>
        </Card>
        ) : null}
        {editorOpen ? routeKey && menus.isError ? (
          <ErrorPanel error={menus.error} retry={() => void menus.refetch()} />
        ) : routeKey && !key ? (
          <LoadingPanel label="Loading navigation menu…" />
        ) : (
        <Card>
          <h2>{routeKey ? "Edit menu structure" : "Create menu"}</h2>
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
        ) : null}
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
  const navigate = useNavigate();
  const location = useLocation();
  const { key: routeKey } = useParams();
  const editorOpen = Boolean(routeKey) || location.pathname.endsWith("/new");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<DataResponse<Setting[]>>("/admin/settings"),
  });
  const savedSetting = routeKey
    ? settings.data?.data.find((item) => item.key === routeKey)
    : undefined;
  const settingsDirty = savedSetting
    ? key !== savedSetting.key ||
      value !== JSON.stringify(savedSetting.value, null, 2) ||
      description !== (savedSetting.description ?? "") ||
      isPublic !== savedSetting.isPublic
    : Boolean(key || description || isPublic || value !== "{}");
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
      navigate("/content/settings");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!routeKey) {
        setKey("");
        setValue("{}");
        setDescription("");
        setIsPublic(false);
        return;
      }
      const record = settings.data?.data.find((item) => item.key === routeKey);
      if (!record) return;
      setKey(record.key);
      setValue(JSON.stringify(record.value, null, 2));
      setDescription(record.description ?? "");
      setIsPublic(record.isPublic);
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, routeKey, settings.data]);
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title={editorOpen ? (routeKey ? "Edit public setting" : "New public setting") : "Public settings"}
        description="Update your social links below. Other company and contact settings are available in the settings list."
        actions={
          editorOpen ? (
            <BackLink to="/content/settings" />
          ) : (
            <ActionLink to="/content/settings/new">New setting</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
        {!editorOpen && settings.isSuccess ? <SocialLinksForm settings={settings.data.data} /> : null}
        {!editorOpen ? (
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
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/content/settings/${encodeURIComponent(item.key)}/edit`)}
                        >
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
        ) : null}
        {editorOpen ? routeKey && settings.isError ? (
          <ErrorPanel error={settings.error} retry={() => void settings.refetch()} />
        ) : routeKey && !key ? (
          <LoadingPanel label="Loading setting…" />
        ) : (
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
            <StickyActionBar dirty={settingsDirty} saving={save.isPending}>
              {settingsDirty ? (
                <ConfirmButton
                  cancelText="Keep editing"
                  confirmText="Discard changes"
                  dialogDescription="Revert the unsaved configuration value and exposure settings?"
                  dialogTitle="Discard setting changes?"
                  onConfirm={() => {
                    setKey(savedSetting?.key ?? "");
                    setValue(savedSetting ? JSON.stringify(savedSetting.value, null, 2) : "{}");
                    setDescription(savedSetting?.description ?? "");
                    setIsPublic(savedSetting?.isPublic ?? false);
                  }}
                  tone="warning"
                >Discard</ConfirmButton>
              ) : null}
              <Button disabled={!key || save.isPending || !settingsDirty} type="submit">Save setting</Button>
            </StickyActionBar>
          </form>
        </Card>
        ) : null}
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
  location: string | null;
  tripName: string | null;
  quote: string;
  rating: number;
  consentNotes: string | null;
  approved: boolean;
  sortOrder: number;
  status: PublicationStatus;
  publishedAt: string | null;
  isDemo: boolean;
};
const blankTestimonial: Partial<Testimonial> = {
  publicName: "",
  location: "",
  tripName: "",
  quote: "",
  rating: 5,
  consentNotes: "",
  approved: false,
  sortOrder: 0,
  status: "DRAFT",
  publishedAt: null,
  isDemo: false,
};
export function EngagementPage() {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const routeMode: "faqs" | "testimonials" = location.pathname.includes("/testimonials/")
    ? "testimonials"
    : "faqs";
  const listMode: "faqs" | "testimonials" = new URLSearchParams(location.search).get("view") === "testimonials"
    ? "testimonials"
    : "faqs";
  const activeMode = editorOpen ? routeMode : listMode;
  const [faq, setFaq] = useState<Partial<Faq>>({
    question: "",
    answer: "",
    sortOrder: 0,
    status: "DRAFT",
    isDemo: false,
    packageId: null,
  });
  const [testimonial, setTestimonial] =
    useState<Partial<Testimonial>>(blankTestimonial);
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
      apiRequest<PageResponse<PackageSummary>>("/admin/packages?view=summary&pageSize=100"),
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
      navigate("/content/engagement?view=faqs");
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
            location: testimonial.location || null,
            tripName: testimonial.tripName || null,
            quote: testimonial.quote,
            rating: Number(testimonial.rating ?? 5),
            consentNotes: testimonial.consentNotes || null,
            approved: Boolean(testimonial.approved),
            sortOrder: Number(testimonial.sortOrder ?? 0),
            status: testimonial.status ?? "DRAFT",
            publishedAt: testimonial.publishedAt
              ? new Date(testimonial.publishedAt).toISOString()
              : null,
            isDemo: Boolean(testimonial.isDemo),
          },
        },
      ),
    onSuccess: async () => {
      notify("Testimonial saved with approval and consent rules enforced.");
      setTestimonial(blankTestimonial);
      await client.invalidateQueries({ queryKey: ["testimonials"] });
      navigate("/content/engagement?view=testimonials");
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
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (routeMode === "faqs") {
        const record = id
          ? faqs.data?.data.find((item) => item.id === id)
          : null;
        setFaq(
          record ?? {
            question: "",
            answer: "",
            sortOrder: 0,
            status: "DRAFT",
            isDemo: false,
            packageId: null,
          },
        );
        return;
      }
      const record = id
        ? testimonials.data?.data.find((item) => item.id === id)
        : null;
      setTestimonial(record ?? blankTestimonial);
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, faqs.data, id, routeMode, testimonials.data]);
  return (
    <>
      <PageHeader
        eyebrow="Trust and answers"
        title={
          editorOpen
            ? `${id ? "Edit" : "New"} ${activeMode === "faqs" ? "FAQ" : "testimonial"}`
            : "FAQs and testimonials"
        }
        description="Package-specific FAQs are supported. Testimonials stay private until genuine consent is recorded and approval is explicit."
        actions={
          editorOpen ? (
            <BackLink to={`/content/engagement?view=${activeMode}`} />
          ) : (
            <ActionLink to={`/content/engagement/${activeMode}/new`}>
              Add {activeMode === "faqs" ? "FAQ" : "testimonial"}
            </ActionLink>
          )
        }
      />
      {!editorOpen ? (
      <div className="mb-5 inline-flex gap-1 rounded-xl border border-admin-border bg-admin-surface p-1 shadow-sm [&_button]:whitespace-nowrap [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-[0.78rem] [&_button]:font-black [&_button]:text-admin-ink-muted">
        <button
          className={
            activeMode === "faqs"
              ? "border-admin-brand! bg-admin-brand! text-white!"
              : ""
          }
          onClick={() => navigate("/content/engagement?view=faqs")}
        >
          FAQs
        </button>
        <button
          className={
            activeMode === "testimonials"
              ? "border-admin-brand! bg-admin-brand! text-white!"
              : ""
          }
          onClick={() => navigate("/content/engagement?view=testimonials")}
        >
          Testimonials
        </button>
      </div>
      ) : null}
      {activeMode === "faqs" ? (
        <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
          {!editorOpen ? (
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
                              onClick={() => navigate(`/content/engagement/faqs/${item.id}/edit`)}
                            >
                              Edit
                            </Button>
                            <ConfirmButton
                              confirmText="Archive FAQ"
                              dialogDescription="This answer will no longer appear on the public site."
                              dialogTitle="Archive this FAQ?"
                              detailText={item.question}
                              onConfirm={() => archive("faqs", item.id)}
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
          ) : null}
          {editorOpen ? id && faqs.isError ? (
            <ErrorPanel error={faqs.error} retry={() => void faqs.refetch()} />
          ) : id && !faq.id ? (
            <LoadingPanel label="Loading FAQ…" />
          ) : (
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
          ) : null}
        </div>
      ) : (
        <div className={editorOpen ? "max-w-4xl" : "grid items-start gap-4"}>
          {!editorOpen ? (
          <Card className="overflow-hidden p-0!">
            {testimonials.isPending ? (
              <LoadingPanel />
            ) : testimonials.isError ? (
              <ErrorPanel
                error={testimonials.error}
                retry={() => void testimonials.refetch()}
              />
            ) : testimonials.data.data.length === 0 ? (
              <EmptyState
                title="No testimonials yet"
                description="Add a traveller story, record consent, then approve and publish it."
              />
            ) : (
              <div>
                <div className="overflow-x-auto max-[680px]:hidden [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:bg-admin-surface-muted [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-admin-ink-muted [&_td]:border-t [&_td]:border-admin-border-soft [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[0.8rem] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-admin-ink-subtle">
                  <table>
                    <thead>
                      <tr>
                        <th>Traveller</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Order</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testimonials.data.data.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="font-bold text-admin-brand-deep">
                              {item.publicName}
                            </span>
                            <small>
                              {[item.tripName, item.location]
                                .filter(Boolean)
                                .join(" - ") || item.quote.slice(0, 80)}
                            </small>
                          </td>
                          <td>{item.rating} / 5</td>
                          <td>
                            <div className="grid justify-items-start gap-1.5">
                              <StatusBadge value={item.status} />
                              {item.approved ? (
                                <StatusBadge value="APPROVED" />
                              ) : (
                                <span className="text-admin-ink-subtle">
                                  Not approved
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{item.sortOrder}</td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1.5">
                              <Button
                                variant="secondary"
                                onClick={() => navigate(`/content/engagement/testimonials/${item.id}/edit`)}
                              >
                                Edit
                              </Button>
                              {item.status !== "ARCHIVED" ? (
                                <ConfirmButton
                                  confirmText="Archive testimonial"
                                  dialogDescription="This testimonial will be removed from public pages."
                                  dialogTitle="Archive this testimonial?"
                                  detailText={item.publicName}
                                  onConfirm={() =>
                                    archive("testimonials", item.id)
                                  }
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
                <div className="hidden gap-3 p-3 max-[680px]:grid">
                  {testimonials.data.data.map((item) => (
                    <article
                      className="rounded-[0.7rem] border border-admin-border-soft bg-admin-surface p-4"
                      key={item.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[0.95rem]">{item.publicName}</h3>
                          <p className="mt-1 text-[0.72rem] text-admin-ink-subtle">
                            {[item.tripName, item.location]
                              .filter(Boolean)
                              .join(" - ") || "Traveller story"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[0.75rem] font-bold text-admin-brand">
                          {item.rating} / 5
                        </span>
                      </div>
                      <p className="my-3 line-clamp-3 text-[0.8rem] leading-relaxed text-admin-ink-muted">
                        {item.quote}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge value={item.status} />
                        {item.approved ? (
                          <StatusBadge value="APPROVED" />
                        ) : null}
                        <span className="ml-auto text-[0.7rem] text-admin-ink-subtle">
                          Order {item.sortOrder}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2 [&>button]:min-h-9 [&>button]:flex-1">
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/content/engagement/testimonials/${item.id}/edit`)}
                        >
                          Edit
                        </Button>
                        {item.status !== "ARCHIVED" ? (
                          <ConfirmButton
                            confirmText="Archive testimonial"
                            dialogDescription="This testimonial will be removed from public pages."
                            dialogTitle="Archive this testimonial?"
                            detailText={item.publicName}
                            onConfirm={() =>
                              archive("testimonials", item.id)
                            }
                          >
                            Archive
                          </ConfirmButton>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </Card>
          ) : null}
          {editorOpen ? id && testimonials.isError ? (
            <ErrorPanel error={testimonials.error} retry={() => void testimonials.refetch()} />
          ) : id && !testimonial.id ? (
            <LoadingPanel label="Loading testimonial…" />
          ) : (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">
                  {testimonial.id ? "Editing story" : "New story"}
                </p>
                <h2>{testimonial.id ? testimonial.publicName : "Add testimonial"}</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft">
              <label>
                Public name
                <input
                  maxLength={120}
                  required
                  value={testimonial.publicName ?? ""}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      publicName: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                <label>
                  Location
                  <input
                    maxLength={120}
                    placeholder="e.g. Mumbai"
                    value={testimonial.location ?? ""}
                    onChange={(event) =>
                      setTestimonial((value) => ({
                        ...value,
                        location: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Trip / package
                  <input
                    maxLength={160}
                    placeholder="e.g. Kashmir escape"
                    value={testimonial.tripName ?? ""}
                    onChange={(event) =>
                      setTestimonial((value) => ({
                        ...value,
                        tripName: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Quote
                <textarea
                  maxLength={5000}
                  required
                  value={testimonial.quote ?? ""}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      quote: event.target.value,
                    }))
                  }
                />
                <span className="text-right text-[0.68rem] font-normal text-admin-ink-subtle">
                  {(testimonial.quote ?? "").length} / 5000
                </span>
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
              <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                <label>
                  Rating
                  <select
                    value={testimonial.rating ?? 5}
                    onChange={(event) =>
                      setTestimonial((value) => ({
                        ...value,
                        rating: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={5}>5 - Excellent</option>
                    <option value={4}>4 - Very good</option>
                    <option value={3}>3 - Good</option>
                    <option value={2}>2 - Fair</option>
                    <option value={1}>1 - Poor</option>
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    min={0}
                    max={10000}
                    type="number"
                    value={testimonial.sortOrder ?? 0}
                    onChange={(event) =>
                      setTestimonial((value) => ({
                        ...value,
                        sortOrder: Number(event.target.value),
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
                <label>
                  Publish date
                  <input
                    type="datetime-local"
                    value={testimonial.publishedAt?.slice(0, 16) ?? ""}
                    onChange={(event) =>
                      setTestimonial((value) => ({
                        ...value,
                        publishedAt: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
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
              <label className="flex! items-center gap-2.5 [&_input]:min-h-0! [&_input]:w-auto!">
                <input
                  checked={Boolean(testimonial.isDemo)}
                  onChange={(event) =>
                    setTestimonial((value) => ({
                      ...value,
                      isDemo: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />{" "}
                Demo content
              </label>
              <div className="flex flex-wrap gap-2 [&>button]:max-[520px]:w-full">
                <Button
                  disabled={
                    saveTestimonial.isPending ||
                    !testimonial.publicName?.trim() ||
                    (testimonial.quote?.trim().length ?? 0) < 10
                  }
                  onClick={() => saveTestimonial.mutate()}
                >
                  {saveTestimonial.isPending ? "Saving..." : "Save testimonial"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/content/engagement?view=testimonials")}
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>
          ) : null}
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
  coverMedia: { id: string; altText: string } | null;
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
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editorOpen = Boolean(id) || location.pathname.endsWith("/new");
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [preview, setPreview] = useState<BlogPost | null>(null);
  const [postQuery, setPostQuery] = useState("");
  const [postStatus, setPostStatus] = useState("");
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
    enabled: editorOpen,
  });
  const packages = useQuery({
    queryKey: ["packages-for-relations"],
    queryFn: () =>
      apiRequest<PageResponse<PackageSummary>>("/admin/packages?view=summary&pageSize=100"),
    enabled: editorOpen,
  });
  const media = useQuery({
    queryKey: ["media-library", "blog"],
    queryFn: () =>
      apiRequest<PageResponse<MediaAsset>>("/admin/media?pageSize=100"),
    enabled: editorOpen,
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
            seoTitle: value.seoTitle.trim() || null,
            seoDescription: value.seoDescription.trim() || null,
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
      if (!editing) navigate(`/blog/${result.data.id}/edit`, { replace: true });
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
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => {
      if (!id) {
        setEditing(null);
        form.reset(blankBlog);
        return;
      }
      const record = posts.data?.data.find((item) => item.id === id);
      if (!record) return;
      setEditing(record);
      form.reset({
        slug: record.slug,
        title: record.title,
        excerpt: record.excerpt,
        contentHtml: record.contentHtml,
        categoryId: record.categoryId ?? "",
        coverMediaId: record.coverMediaId ?? "",
        publicAuthorName: record.publicAuthorName ?? "",
        publicAuthorBio: record.publicAuthorBio ?? "",
        seoTitle: record.seoTitle ?? "",
        seoDescription: record.seoDescription ?? "",
        tagIds: record.tags.map((relation) => relation.tag.id),
        relatedPackageIds: record.relatedTours.map(
          (relation) => relation.package.id,
        ),
        relatedPostIds: record.relatedArticles.map(
          (relation) => relation.relatedPost.id,
        ),
        isFeatured: record.isFeatured,
        status: record.status,
        publishedAt: record.publishedAt?.slice(0, 16) ?? "",
        isDemo: record.isDemo,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, form, id, posts.data]);
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
  const cover = preview?.coverMedia ?? null;
  const visiblePosts = (posts.data?.data ?? []).filter((item) => {
    const matchesQuery =
      !postQuery ||
      `${item.title} ${item.slug}`.toLowerCase().includes(postQuery.toLowerCase());
    return matchesQuery && (!postStatus || item.status === postStatus);
  });
  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title={editorOpen ? (editing ? "Edit article" : "New article") : "Blog publishing"}
        description="Drafts stay private. Stored HTML is sanitised by Express and reading time is calculated from content."
        actions={
          editorOpen ? (
            <BackLink to="/blog" />
          ) : (
            <ActionLink to="/blog/new">New article</ActionLink>
          )
        }
      />
      <div className={editorOpen ? "max-w-5xl" : "grid items-start gap-4"}>
        {!editorOpen ? (
        <div className="grid gap-3 rounded-2xl border border-admin-border bg-admin-surface p-3 shadow-admin-card">
          <label className="grid gap-1.5 text-[0.79rem] font-bold text-admin-brand-deep">
            Search articles
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 text-admin-ink-subtle" size={16} />
              <input className="admin-control pl-9! pr-9!" onChange={(event) => setPostQuery(event.target.value)} placeholder="Title or URL slug" value={postQuery} />
              {postQuery ? <button aria-label="Clear search" className="absolute right-2 inline-flex size-7 items-center justify-center rounded-lg border-0 bg-transparent text-admin-ink-subtle hover:bg-admin-surface-muted" onClick={() => setPostQuery("")} type="button"><X size={15} /></button> : null}
            </span>
          </label>
          <div className="flex gap-2 overflow-x-auto border-t border-admin-border-soft pt-3">
            {[{ label: "All", value: "" }, { label: "Published", value: "PUBLISHED" }, { label: "Drafts", value: "DRAFT" }, { label: "Archived", value: "ARCHIVED" }].map((filter) => {
              const count = (posts.data?.data ?? []).filter((item) => !filter.value || item.status === filter.value).length;
              return <button className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[0.72rem] font-black transition ${postStatus === filter.value ? "border-admin-brand bg-admin-brand text-white" : "border-admin-border bg-white text-admin-ink-muted hover:bg-admin-brand-soft"}`} key={filter.value} onClick={() => setPostStatus(filter.value)} type="button">{filter.label} ({count})</button>;
            })}
          </div>
        </div>
        ) : null}
        {!editorOpen ? (
        <Card className="overflow-hidden p-0!">
          {posts.isPending ? (
            <LoadingPanel />
          ) : visiblePosts.length === 0 ? (
            <EmptyState title="No articles match" description={postQuery || postStatus ? "Clear or change the filters to see more articles." : "Create the first article as a private draft."} action={!postQuery && !postStatus ? <ActionLink to="/blog/new">Create article</ActionLink> : undefined} />
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
                  {visiblePosts.map((item) => (
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
                            onClick={() => navigate(`/blog/${item.id}/edit`)}
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
                            confirmText="Archive article"
                            dialogDescription="This article will be removed from the public journal and kept as an archived record."
                            dialogTitle="Archive blog article?"
                            detailText={item.title}
                            onConfirm={() => archive.mutateAsync(item.id)}
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
        ) : null}
        {editorOpen ? id && posts.isError ? (
          <ErrorPanel error={posts.error} retry={() => void posts.refetch()} />
        ) : id && !editing ? (
          <LoadingPanel label="Loading article…" />
        ) : (
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
              <SeoFields
                titleField={form.register("seoTitle")}
                descriptionField={form.register("seoDescription")}
                titleValue={form.watch("seoTitle")}
                descriptionValue={form.watch("seoDescription")}
                fallbackTitle={form.watch("title")}
                fallbackDescription={form.watch("excerpt")}
                titleError={form.formState.errors.seoTitle?.message}
                descriptionError={form.formState.errors.seoDescription?.message}
              />
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
        ) : null}
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
