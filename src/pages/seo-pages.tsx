/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { SeoFields } from "../components/SeoFields";
import { DeleteRecordButton } from "../components/DeleteButton";
import { ActionLink, BackLink, Button, Card, ErrorPanel, LoadingPanel, PageHeader, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

type SeoPage = { key: string; path: string; label: string; metaTitle: string; metaDescription: string };
const schema = z.object({ metaTitle: z.string().trim().max(70), metaDescription: z.string().trim().max(170) });
type Values = z.infer<typeof schema>;

export function PageSeoPage() {
  const { key } = useParams();
  const query = useQuery({ queryKey: ["page-seo"], queryFn: () => apiRequest<DataResponse<SeoPage[]>>("/admin/seo/pages") });
  if (query.isPending) return <LoadingPanel label="Loading page SEO..." />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const page = query.data.data.find((item) => item.key === key);
  if (key && !page) return <PageHeader eyebrow="Page SEO" title="Page not found" description="Choose a page from Page SEO." actions={<BackLink to="/content/seo" />} />;
  if (page) return <PageSeoEditor key={page.key} page={page} />;
  return (
    <>
      <PageHeader eyebrow="Website" title="Page SEO" description="Manage Meta Title and Meta Description for the website’s static pages. Package and blog meta tags are edited in their own content forms." />
      <Card className="overflow-hidden p-0!">
        <div aria-hidden="true" className="hidden grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_14rem] gap-5 border-b border-admin-border bg-admin-surface-muted px-5 py-3 text-xs font-bold uppercase tracking-wide text-admin-ink-muted lg:grid">
          <span>Page</span><span>Meta title and description</span><span>Actions</span>
        </div>
        <ul aria-label="Page SEO list" className="m-0 list-none divide-y divide-admin-border-soft p-0">
          {query.data.data.map((item) => (
            <li key={item.key} className="grid min-w-0 items-center gap-4 px-5 py-4 transition hover:bg-admin-surface-muted/50 lg:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_14rem] lg:gap-5">
              <div className="min-w-0">
                <h2 className="m-0! text-base! font-bold text-admin-brand-deep">{item.label}</h2>
                <p className="mt-1 mb-0 text-xs wrap-anywhere text-admin-ink-subtle">{item.path}</p>
              </div>
              <div className="min-w-0 text-sm">
                <p className="m-0 line-clamp-2 wrap-anywhere font-semibold text-admin-ink">{item.metaTitle || "Using the page’s default title"}</p>
                <p className="mt-1 mb-0 line-clamp-2 wrap-anywhere text-xs leading-5 text-admin-ink-muted">{item.metaDescription || "Using the page’s default description"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionLink to={`/content/seo/${item.key}/edit`} variant="secondary">Edit meta tags</ActionLink>
                {item.metaTitle || item.metaDescription ? <DeleteRecordButton
                  resource="saved meta tags" name={item.label} label="Reset"
                  description="Delete the saved meta title and description? This page will use its default metadata. The page itself will remain available."
                  endpoint={`/admin/settings/seo.pages.${item.key}/permanent`} invalidateKeys={["settings", "page-seo"]} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function PageSeoEditor({ page }: { page: SeoPage }) {
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { metaTitle: page.metaTitle, metaDescription: page.metaDescription } });
  useUnsavedChanges(form.formState.isDirty);
  const save = useMutation({
    mutationFn: (value: Values) => apiRequest(`/admin/settings/seo.pages.${page.key}`, {
      method: "PUT", csrfToken,
      body: { value, isPublic: true, description: `${page.label} page meta tags` },
    }),
    onSuccess: async (_result, values) => {
      form.reset(values);
      await Promise.all([client.invalidateQueries({ queryKey: ["page-seo"] }), client.invalidateQueries({ queryKey: ["settings"] })]);
      notify(`${page.label} meta tags saved.`);
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  return (
    <>
      <PageHeader eyebrow="Page SEO" title={`${page.label} meta tags`} description={`Public page: ${page.path}. Leave fields blank to use the page’s default metadata.`} actions={<BackLink to="/content/seo" />} />
      <Card className="max-w-3xl">
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <fieldset disabled={save.isPending} className="min-w-0 border-0 p-0">
            <SeoFields titleField={form.register("metaTitle")} descriptionField={form.register("metaDescription")} titleValue={form.watch("metaTitle")} descriptionValue={form.watch("metaDescription")} fallbackTitle={page.label} titleError={form.formState.errors.metaTitle?.message} descriptionError={form.formState.errors.metaDescription?.message} />
          </fieldset>
          <div><Button type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending ? "Saving..." : "Save meta tags"}</Button></div>
        </form>
      </Card>
    </>
  );
}
