import { AdminSelect } from "../components/AdminSelect";
import { FormSelect } from "../components/FormSelect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  apiRequest,
  type DataResponse,
  type PageResponse,
} from "../api";
import { useAuth } from "../auth";
import { DeleteRecordButton } from "../components/DeleteButton";
import { parseMenuLines } from "../lib/navigation";
import type { PackageSummary, PublicationStatus } from "../types";
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
  StatusBadge,
  getErrorMessage,
  useToast,
  useUnsavedChanges,
} from "../ui";

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
                          <DeleteRecordButton resource="homepage section" name={item.title || item.type} endpoint={`/admin/home/sections/${item.id}/permanent`} invalidateKeys={["home-sections"]} />
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
              <FormSelect control={form.control} name={"type"}>
                {sectionTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </FormSelect>
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
                <FormSelect control={form.control} name={"status"}>
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </FormSelect>
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
              <div key={menu.id} className="flex items-center justify-between gap-3">
              <button
                className={menu.key === key ? "text-admin-accent!" : ""}
                onClick={() => navigate(`/content/navigation/${encodeURIComponent(menu.key)}/edit`)}
              >
                {menu.label}
                <span>{menu.items.length} links</span>
              </button>
              <DeleteRecordButton resource="menu" name={menu.label}
                description="Permanently delete this menu and its links? Linked pages will be kept."
                endpoint={`/admin/navigation/${encodeURIComponent(menu.key)}/permanent`} invalidateKeys={["navigation"]} />
              </div>
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
                            <DeleteRecordButton resource="FAQ" name={item.question} endpoint={`/admin/faqs/${item.id}/permanent`} invalidateKeys={["faqs"]} />
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
                <AdminSelect
                  value={faq.packageId ?? ""}
                  onValueChange={(selectedValue) =>
                    setFaq((value) => ({
                      ...value,
                      packageId: selectedValue || null,
                    }))
                  }
                >
                  <option value="">Global FAQ</option>
                  {packages.data?.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </AdminSelect>
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
                <AdminSelect
                  value={faq.status}
                  onValueChange={(selectedValue) =>
                    setFaq((value) => ({
                      ...value,
                      status: selectedValue as PublicationStatus,
                    }))
                  }
                >
                  <option>DRAFT</option>
                  <option>PUBLISHED</option>
                  <option>ARCHIVED</option>
                </AdminSelect>
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
                              <DeleteRecordButton resource="testimonial" name={item.publicName} endpoint={`/admin/testimonials/${item.id}/permanent`} invalidateKeys={["testimonials"]} />
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
                        <DeleteRecordButton resource="testimonial" name={item.publicName} endpoint={`/admin/testimonials/${item.id}/permanent`} invalidateKeys={["testimonials"]} />
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
                  <AdminSelect
                    value={testimonial.rating ?? 5}
                    onValueChange={(selectedValue) =>
                      setTestimonial((value) => ({
                        ...value,
                        rating: Number(selectedValue),
                      }))
                    }
                  >
                    <option value={5}>5 - Excellent</option>
                    <option value={4}>4 - Very good</option>
                    <option value={3}>3 - Good</option>
                    <option value={2}>2 - Fair</option>
                    <option value={1}>1 - Poor</option>
                  </AdminSelect>
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
                  <AdminSelect
                    value={testimonial.status}
                    onValueChange={(selectedValue) =>
                      setTestimonial((value) => ({
                        ...value,
                        status: selectedValue as PublicationStatus,
                      }))
                    }
                  >
                    <option>DRAFT</option>
                    <option>PUBLISHED</option>
                    <option>ARCHIVED</option>
                  </AdminSelect>
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
