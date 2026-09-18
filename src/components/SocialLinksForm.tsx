import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Button, Card, FieldError, getErrorMessage, useToast, useUnsavedChanges } from "../ui";

function socialUrl(network: "instagram" | "facebook") {
  return z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password &&
        (url.hostname === `${network}.com` || url.hostname.endsWith(`.${network}.com`));
    } catch { return false; }
  }, `Enter an HTTPS ${network}.com link, or leave blank to hide it.`);
}
const schema = z.object({ instagram: socialUrl("instagram"), facebook: socialUrl("facebook") });
type Values = z.infer<typeof schema>;

function settingUrl(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "text", "url", "href"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return "";
}

export function SocialLinksForm({ settings }: { settings: Array<{ key: string; value: unknown }> }) {
  const instagram = settingUrl(settings.find((item) => item.key === "social.instagram")?.value);
  const facebook = settingUrl(settings.find((item) => item.key === "social.facebook")?.value);
  const { csrfToken } = useAuth();
  const { notify } = useToast();
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { instagram, facebook } });
  useUnsavedChanges(form.formState.isDirty);
  useEffect(() => {
    if (!form.formState.isDirty) form.reset({ instagram, facebook });
  }, [form, instagram, facebook]);
  const save = useMutation({
    mutationFn: (values: Values) => apiRequest("/admin/settings/social-links", {
      method: "PUT", csrfToken, body: values,
    }),
    onSuccess: async (_result, values) => {
      form.reset(values);
      await client.invalidateQueries({ queryKey: ["settings"] });
      notify("Social links saved.");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  return (
    <Card>
      <h2>Social links</h2>
      <p className="mt-2 text-sm text-admin-ink-muted">These links appear on the public website’s footer and contact page. Leave a link blank to hide it.</p>
      <form className="mt-5 grid gap-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <fieldset className="grid gap-4 border-0 p-0 sm:grid-cols-2" disabled={save.isPending}>
          <label className="grid gap-2 text-sm font-bold text-admin-brand-deep">
            Instagram URL
            <input className="admin-control" type="url" maxLength={2048} placeholder="https://www.instagram.com/br_tours_travels/" {...form.register("instagram")} />
            <FieldError message={form.formState.errors.instagram?.message} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-admin-brand-deep">
            Facebook URL
            <input className="admin-control" type="url" maxLength={2048} placeholder="https://www.facebook.com/your-page" {...form.register("facebook")} />
            <FieldError message={form.formState.errors.facebook?.message} />
          </label>
        </fieldset>
        <div><Button disabled={save.isPending || !form.formState.isDirty} type="submit">{save.isPending ? "Saving..." : "Save social links"}</Button></div>
      </form>
    </Card>
  );
}
