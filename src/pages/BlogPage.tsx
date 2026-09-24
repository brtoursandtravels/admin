import { lazy, Suspense, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, Eye, FileText, LockKeyhole, Plus, Search, UnlockKeyhole } from "lucide-react";
import { apiRequest, privateMediaUrl, type DataResponse, type PageResponse } from "../api";
import { useAuth } from "../auth";
import { env } from "../env";
import type { PackageSummary } from "../types";
import { articleSlug, articleText, blankBlog, blogPayload, blogSchema, blogToForm, type BlogCategory, type BlogForm, type BlogPost, type BlogSummary } from "../lib/blog-editor";
import { BlogTaxonomyManager } from "../components/BlogTaxonomyManager";
import { DeleteRecordButton } from "../components/DeleteButton";
import { EditorDialog } from "../components/EditorDialog";
import { MediaPicker } from "../components/FileUploader";
import { FormSelect } from "../components/FormSelect";
import { MultiChoiceField } from "../components/MultiChoiceField";
import { SeoFields } from "../components/SeoFields";
import { ActionLink, BackLink, Button, Card, ConfirmButton, EmptyState, ErrorPanel, FieldError, LoadingPanel, PageHeader, StatusBadge, StickyActionBar, formatDate, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

const RichTextEditor = lazy(() => import("../components/RichTextEditor"));
const summaryQuery = { queryKey: ["blog-posts", "summary"], queryFn: () => apiRequest<DataResponse<BlogSummary[]>>("/admin/blog/posts?view=summary") };

export default function BlogPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const detail = useQuery({ queryKey: ["blog-post", id], queryFn: () => apiRequest<DataResponse<BlogPost>>(`/admin/blog/posts/${id}`), enabled: Boolean(id) });
  if (pathname.endsWith("/new")) return <BlogEditor key="new" />;
  if (id) return <><PageHeader eyebrow="Editorial" title="Edit article" description="Shape your story, choose a cover photo and publish when it is ready." actions={<BackLink to="/blog" />} />{detail.isPending ? <LoadingPanel label="Loading article…" /> : detail.isError ? <ErrorPanel error={detail.error} retry={() => void detail.refetch()} /> : <BlogEditor key={id} post={detail.data.data} />}</>;
  return <BlogList />;
}

function BlogList() {
  const posts = useQuery(summaryQuery);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const archive = useMutation({ mutationFn: (id: string) => apiRequest(`/admin/blog/posts/${id}`, { method: "DELETE", csrfToken }), onSuccess: async () => { notify("Article archived."); await client.invalidateQueries({ queryKey: ["blog-posts"] }); } });
  const rows = posts.data?.data ?? [];
  const visible = rows.filter(post => (!status || post.status === status) && `${post.title} ${post.excerpt}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <PageHeader eyebrow="Editorial" title="Blog articles" description="Share travel stories, useful guides and updates with your readers." actions={<ActionLink to="/blog/new"><Plus size={16} />New article</ActionLink>} />
    <BlogTaxonomyManager />
    <section className="mb-5 rounded-2xl border border-admin-border bg-white p-4">
      <label className="grid gap-2 text-sm font-bold">Search articles<span className="relative"><Search size={17} className="absolute top-3.5 left-3 text-admin-ink-muted" /><input className="admin-control pl-10!" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Article title or description" /></span></label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Article status">{[{ value: "", label: "All articles" }, { value: "DRAFT", label: "Drafts" }, { value: "PUBLISHED", label: "Published" }, { value: "ARCHIVED", label: "Archived" }].map(option => <button type="button" key={option.value} aria-pressed={status === option.value} onClick={() => setStatus(option.value)} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${status === option.value ? "bg-admin-brand text-white" : "bg-admin-surface-muted text-admin-ink-muted"}`}>{option.label} ({rows.filter(post => !option.value || post.status === option.value).length})</button>)}</div><span className="text-sm text-admin-ink-muted" aria-live="polite">{visible.length} {visible.length === 1 ? "article" : "articles"}</span></div>
    </section>
    {posts.isPending ? <LoadingPanel /> : posts.isError ? <ErrorPanel error={posts.error} retry={() => void posts.refetch()} /> : !visible.length ? <Card><EmptyState title="No articles found" description={search || status ? "Try another search or clear the filters." : "Start with a draft and build your first travel story."} action={search || status ? <Button onClick={() => { setSearch(""); setStatus(""); }}>Clear filters</Button> : <ActionLink to="/blog/new">Create article</ActionLink>} /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(post => <article key={post.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-admin-border bg-white shadow-admin-card">
      <div className="relative grid aspect-[16/7] place-items-center bg-admin-brand-soft">{post.coverMedia ? <img className="h-full w-full object-cover" src={privateMediaUrl(post.coverMedia.id)} alt={post.coverMedia.altText} loading="lazy" /> : <FileText size={36} className="text-admin-brand" />}<span className="absolute top-3 left-3 rounded-full bg-white"><StatusBadge value={post.status} /></span></div>
      <div className="flex flex-1 flex-col p-4"><h2 className="m-0 line-clamp-2 text-lg font-bold">{post.title}</h2><p className="my-3 line-clamp-3 text-sm leading-6 text-admin-ink-muted">{post.excerpt}</p><p className="mt-auto mb-4 text-xs text-admin-ink-muted">Updated {formatDate(post.updatedAt)}</p><div className="flex flex-wrap gap-2 border-t border-admin-border-soft pt-3"><ActionLink to={`/blog/${post.id}/edit`} variant="secondary">Edit article</ActionLink><Button type="button" variant="ghost" onClick={() => setPreviewId(post.id)}>Preview</Button>{post.status !== "ARCHIVED" && <ConfirmButton type="button" tone="warning" disabled={archive.isPending} dialogTitle="Archive blog article?" dialogDescription="This hides the article from the public blog. You can publish it again from the editor." detailText={post.title} confirmText="Archive article" onConfirm={() => archive.mutateAsync(post.id)}><Archive size={14} />Archive</ConfirmButton>}<DeleteRecordButton resource="blog article" name={post.title} endpoint={`/admin/blog/posts/${post.id}/permanent`} description="Permanently delete this article? Its image files will stay in your media library." invalidateKeys={["blog-posts", "media-library"]} /></div></div>
    </article>)}</div>}
    {previewId && <SavedArticlePreview id={previewId} onClose={() => setPreviewId(null)} />}
  </>;
}

function SavedArticlePreview({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["blog-post", id], queryFn: () => apiRequest<DataResponse<BlogPost>>(`/admin/blog/posts/${id}`) });
  const post = detail.data?.data;
  return <EditorDialog title="Article preview" onClose={onClose}>{detail.isPending ? <LoadingPanel /> : detail.isError ? <ErrorPanel error={detail.error} retry={() => void detail.refetch()} /> : post && <article className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold leading-tight">{post.title}</h1><p className="mb-5 text-lg leading-7 text-admin-ink-muted">{post.excerpt}</p>{post.coverMedia && <img className="mb-6 aspect-video w-full rounded-xl object-cover" src={privateMediaUrl(post.coverMedia.id)} alt={post.coverMedia.altText} />}<Suspense fallback={<LoadingPanel />}><RichTextEditor id="saved-article-preview" value={post.contentHtml} readOnly /></Suspense></article>}</EditorDialog>;
}

function BlogEditor({ post }: { post?: BlogPost }) {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [record, setRecord] = useState(post);
  const [suffix] = useState(() => crypto.randomUUID().replaceAll("-", "").slice(0, 10));
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const form = useForm<BlogForm>({ resolver: zodResolver(blogSchema), defaultValues: post ? blogToForm(post) : blankBlog });
  const values = useWatch({ control: form.control }) as BlogForm;
  useUnsavedChanges(form.formState.isDirty || uploading);
  const categories = useQuery({ queryKey: ["blog-categories"], queryFn: () => apiRequest<DataResponse<BlogCategory[]>>("/admin/blog/categories") });
  const packages = useQuery({ queryKey: ["packages-for-relations"], queryFn: () => apiRequest<PageResponse<PackageSummary>>("/admin/packages?view=summary&pageSize=100") });
  const save = useMutation({
    mutationFn: (value: BlogForm) => apiRequest<DataResponse<BlogPost>>(record ? `/admin/blog/posts/${record.id}` : "/admin/blog/posts", { method: record ? "PUT" : "POST", csrfToken, body: blogPayload(value, record) }),
    onSuccess: result => {
      flushSync(() => { setRecord(result.data); form.reset(blogToForm(result.data)); });
      client.setQueryData(["blog-post", result.data.id], result);
      void client.invalidateQueries({ queryKey: ["blog-posts"] });
      notify("Article saved.");
      if (!post) navigate(`/blog/${result.data.id}/edit`, { replace: true });
    },
    onError: error => notify(getErrorMessage(error), "error"),
  });
  const createCategory = useMutation({
    mutationFn: () => apiRequest<DataResponse<BlogCategory>>("/admin/blog/categories", { method: "POST", csrfToken, body: { name: categoryName.trim(), slug: articleSlug(categoryName, crypto.randomUUID().slice(0, 8)), status: "PUBLISHED", publishedAt: null, isDemo: false } }),
    onSuccess: async result => {
      await client.invalidateQueries({ queryKey: ["blog-categories"] });
      form.setValue("categoryId", result.data.id, { shouldDirty: true });
      notify("Category added."); setCategoryOpen(false); setCategoryName("");
    },
  });
  const errors = form.formState.errors;
  const text = articleText(values.contentHtml);
  const words = text ? text.split(/\s+/).length : 0;
  const openCategory = () => { createCategory.reset(); setCategoryName(""); setCategoryOpen(true); };
  const relatedPackages = [...(packages.data?.data ?? []), ...(record?.relatedTours.map(item => item.package) ?? []).filter(item => !packages.data?.data.some(post => post.id === item.id))];

  return <>
    {!post && <PageHeader eyebrow="Editorial" title="New article" description="Write a travel story, add helpful details and preview it before publishing." actions={<BackLink to="/blog" />} />}
    <form noValidate onSubmit={form.handleSubmit(value => { if (!uploading && !save.isPending) save.mutate(value); }, invalid => { if (invalid.contentHtml && !invalid.title && !invalid.excerpt) document.getElementById("article-content")?.focus(); })}>
      <fieldset disabled={save.isPending} className="min-w-0 border-0 p-0">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid min-w-0 gap-5">
            <Card><h2 className="m-0">Write your article</h2><p className="mt-2 mb-5 text-sm text-admin-ink-muted">The short description appears on blog cards. The full story appears on the article page.</p>
              <div className="admin-form">
                <label>Article title<input autoFocus={!post} aria-label="Article title" maxLength={220} placeholder="For example, A first-time guide to Rajasthan" {...form.register("title", { onChange: event => { if (!record && !slugUnlocked) form.setValue("slug", articleSlug(event.target.value, suffix), { shouldDirty: true }); } })} /><FieldError message={errors.title?.message} /></label>
                <label>Short description<textarea aria-label="Short description" rows={3} maxLength={500} placeholder="Give readers a reason to open this article…" {...form.register("excerpt")} /><span className="text-xs font-normal text-admin-ink-muted">{values.excerpt.length}/500 characters</span><FieldError message={errors.excerpt?.message} /></label>
                <div className="grid min-w-0 gap-2"><label htmlFor="article-content">Article content</label><Suspense fallback={<LoadingPanel label="Loading writing tools…" />}><RichTextEditor value={values.contentHtml} disabled={save.isPending} invalid={Boolean(errors.contentHtml)} onChange={html => form.setValue("contentHtml", html, { shouldDirty: true, shouldValidate: Boolean(errors.contentHtml) })} onBlur={() => void form.trigger("contentHtml")} /></Suspense><FieldError message={errors.contentHtml?.message} /></div>
              </div>
            </Card>
            <Card><MediaPicker label="Cover image" helperText="Choose the photo shown at the top of the article and on blog cards. Use a public image so visitors can see it." ids={values.coverMediaId ? [values.coverMediaId] : []} disabled={save.isPending} onBusyChange={setUploading} onChange={assets => form.setValue("coverMediaId", assets[0]?.id ?? "", { shouldDirty: true })} /></Card>
            <Card><details><summary className="cursor-pointer text-base font-bold text-admin-brand-deep">Related tours</summary><p className="text-sm text-admin-ink-muted">Help readers discover tour packages at the end of this article.</p><div className="mt-4">{packages.isError ? <ErrorPanel error={packages.error} retry={() => void packages.refetch()} /> : <MultiChoiceField label="Related packages" options={relatedPackages.map(item => ({ id: item.id, label: item.title }))} value={values.relatedPackageIds} limit={30} disabled={packages.isPending || save.isPending} onChange={ids => form.setValue("relatedPackageIds", ids, { shouldDirty: true })} />}</div></details></Card>
            <Card><details><summary className="cursor-pointer text-base font-bold text-admin-brand-deep">Search engine details</summary><div className="admin-form mt-5"><SeoFields titleField={form.register("seoTitle")} descriptionField={form.register("seoDescription")} titleValue={values.seoTitle} descriptionValue={values.seoDescription} fallbackTitle={values.title} fallbackDescription={values.excerpt} titleError={errors.seoTitle?.message} descriptionError={errors.seoDescription?.message} />
              <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="article-slug">Article address</label><Button type="button" variant="ghost" onClick={() => setSlugUnlocked(!slugUnlocked)}>{slugUnlocked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{slugUnlocked ? "Lock address" : "Edit address"}</Button></div><input id="article-slug" readOnly={!slugUnlocked} {...form.register("slug")} /><FieldError message={errors.slug?.message} /><p className="m-0 text-xs font-normal text-admin-ink-muted">Created automatically for new articles. Existing addresses stay the same when you rename an article.</p></div>
            </div></details></Card>
          </div>
          <aside className="grid min-w-0 gap-5" aria-label="Article settings">
            <Card><h2 className="m-0">Publishing</h2><div className="admin-form mt-5"><label>Status<FormSelect aria-label="Status" control={form.control} name="status"><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></FormSelect></label><p className="m-0 rounded-xl bg-admin-surface-muted p-3 text-sm leading-6 text-admin-ink-muted">{values.status === "DRAFT" ? "Only admins can see this draft." : values.status === "ARCHIVED" ? "This article stays saved and is hidden from the public blog." : "This article will be public after you save, or at the publication time you choose."}</p>{values.status === "PUBLISHED" && <label>Publish date & time<input aria-label="Publish date & time" type="datetime-local" {...form.register("publishedAt")} /><span className="admin-form-help">Leave empty to publish now. Uses your device’s timezone.</span><FieldError message={errors.publishedAt?.message} /></label>}<label className="flex! items-center gap-2!"><input className="size-4 accent-admin-brand" type="checkbox" {...form.register("isFeatured")} />Featured article</label><Button type="button" variant="secondary" onClick={() => setPreview(true)}><Eye size={16} />Preview article</Button><div className="flex justify-between text-xs text-admin-ink-muted"><span>{words} words</span><span>{Math.max(1, Math.ceil(words / 220))} min read</span></div></div></Card>
            <Card><h2 className="m-0">Organise your article</h2><div className="admin-form mt-5"><label>Category<FormSelect aria-label="Category" control={form.control} name="categoryId" disabled={categories.isPending || categories.isError || save.isPending}><option value="">Uncategorised</option>{categories.data?.data.filter(item => item.status !== "ARCHIVED" || values.categoryId === item.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormSelect></label>{categories.isError && <ErrorPanel error={categories.error} retry={() => void categories.refetch()} />}<Button type="button" variant="ghost" onClick={openCategory}><Plus size={14} />New category</Button></div></Card>
          </aside>
        </div>
      </fieldset>
      {Object.keys(errors).length > 0 && <p className="mt-4 rounded-xl bg-admin-negative-soft p-3 text-sm text-admin-negative" role="alert">Check the highlighted fields before saving.{errors.slug && ` ${errors.slug.message}`}</p>}
      {save.isError && <div className="mt-4"><ErrorPanel error={save.error} /></div>}
      <StickyActionBar dirty={form.formState.isDirty} saving={save.isPending || uploading}><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={save.isPending || uploading} onClick={() => navigate("/blog")}>Back to articles</Button><Button type="submit" disabled={save.isPending || uploading}>{save.isPending ? "Saving…" : uploading ? "Uploading photo…" : "Save article"}</Button></div></StickyActionBar>
    </form>
    {preview && <EditorDialog title="Article preview" onClose={() => setPreview(false)}><article className="mx-auto max-w-3xl"><p className="text-xs font-bold text-admin-brand">Unsaved preview · {categories.data?.data.find(item => item.id === values.categoryId)?.name ?? "Travel journal"}</p><h1 className="mb-4 text-3xl font-bold leading-tight wrap-anywhere">{values.title || "Your article title"}</h1><p className="mb-5 text-lg leading-7 text-admin-ink-muted">{values.excerpt || "Your short description will appear here."}</p>{values.coverMediaId && <img className="mb-6 aspect-video w-full rounded-xl object-cover" src={privateMediaUrl(values.coverMediaId)} alt="Article cover preview" />}<Suspense fallback={<LoadingPanel />}><RichTextEditor id="article-preview-content" value={values.contentHtml} readOnly /></Suspense></article></EditorDialog>}
    {categoryOpen && <EditorDialog title="New blog category" busy={createCategory.isPending} onClose={() => setCategoryOpen(false)}><form className="admin-form" onSubmit={event => { event.preventDefault(); if (categoryName.trim().length >= 2 && !createCategory.isPending) createCategory.mutate(); }}><label>Name<input autoFocus value={categoryName} disabled={createCategory.isPending} maxLength={160} minLength={2} required onChange={event => setCategoryName(event.target.value)} /></label>{createCategory.isError && <ErrorPanel error={createCategory.error} />}<Button type="submit" disabled={createCategory.isPending || categoryName.trim().length < 2}>{createCategory.isPending ? "Adding…" : "Add category"}</Button></form></EditorDialog>}
    {record?.status === "PUBLISHED" && <p className="mt-4 text-center text-xs"><Link to={new URL(`/blog/${record.slug}`, env.publicSiteUrl).toString()} target="_blank" rel="noreferrer" className="font-bold text-admin-brand underline underline-offset-4">Open public article</Link></p>}
  </>;
}
