/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { SeoFields } from "../components/SeoFields";
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
      <PageHeader eyebrow="Website" title="Page SEO" description="Manage Meta Title and Meta Description for the website’s static pages. Package, blog and custom-page meta tags are edited in their own content forms." />
      <div className="grid gap-4 sm:grid-cols-2">
        {query.data.data.map((item) => (
          <Card key={item.key}>
            <h2>{item.label}</h2>
            <p className="text-sm text-admin-ink-subtle">{item.path}</p>
            <p className="my-3 text-sm text-admin-ink-muted">{item.metaTitle || "Using the page’s default title"}</p>
            <ActionLink to={`/content/seo/${item.key}/edit`} variant="secondary">Edit meta tags</ActionLink>
          </Card>
        ))}
      </div>
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
