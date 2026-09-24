import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpenText,
  CalendarDays,
  FileText,
  Inbox,
  Plus,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import { env } from "../env";
import {
  Button,
  Card,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  getErrorMessage,
  useToast,
} from "../ui";

type Dashboard = {
  packages: number;
  publishedPackages: number;
  upcomingDepartures: number;
  newEnquiries: number;
  draftPosts: number;
  publishedPosts: number;
  enquiryStatusCounts: Record<string, number>;
  enquiryTrend: Array<{ date: string; count: number }>;
  generatedAt: string;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-admin-border bg-admin-surface p-5 shadow-admin-card transition duration-200 hover:-translate-y-0.5 hover:border-admin-brand/20 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.76rem] font-black text-admin-ink-muted">{label}</span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-admin-brand-soft text-admin-brand">
          <Icon size={19} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <strong className="my-3 block text-[2.4rem] font-black leading-none tracking-[-0.045em] text-admin-brand-deep">
        {value}
      </strong>
      <small className="block text-[0.74rem] leading-5 text-admin-ink-subtle">{detail}</small>
    </article>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DataResponse<Dashboard>>("/admin/dashboard"),
    staleTime: 30_000,
  });
  return (
    <>
      <PageHeader
        eyebrow="Live operations"
        title={`Welcome, ${user?.displayName ?? "team"}.`}
        description="These counts come directly from the current database; no traffic or revenue values are fabricated."
      />
      {query.isPending ? (
        <LoadingPanel />
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="mb-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-admin-brand-deep px-5 py-4 text-white shadow-admin-elevated">
            <div>
              <p className="m-0 text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent-light">Quick create</p>
              <strong className="mt-1 block text-base">Start the next task without leaving your flow.</strong>
            </div>
            <div className="flex flex-wrap gap-2 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-xl [&_a]:bg-white/10 [&_a]:px-3.5 [&_a]:text-[0.76rem] [&_a]:font-black [&_a]:text-white [&_a]:no-underline [&_a]:transition [&_a:hover]:bg-white/18">
              {user?.role !== "SALES_AGENT" ? (
                <>
                  <Link to="/packages/new"><Plus size={15} />New package</Link>
                  <Link to="/media/new"><UploadCloud size={15} />Upload media</Link>
                </>
              ) : null}
              {user?.role !== "CONTENT_EDITOR" ? <Link to="/enquiries"><Inbox size={15} />View new enquiries</Link> : null}
            </div>
          </section>
          <div className="mb-5 grid grid-cols-4 gap-4 max-[1350px]:grid-cols-2 max-[560px]:grid-cols-1">
            <MetricCard icon={BookOpenText} label="Active packages" value={query.data.data.packages} detail={`${query.data.data.publishedPackages} currently published`} />
            <MetricCard icon={Inbox} label="New enquiries" value={query.data.data.newEnquiries} detail="Awaiting first response" />
            <MetricCard icon={CalendarDays} label="Upcoming departures" value={query.data.data.upcomingDepartures} detail="Scheduled future options" />
            <MetricCard icon={FileText} label="Published articles" value={query.data.data.publishedPosts} detail={`${query.data.data.draftPosts} drafts remain private`} />
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-4 max-[900px]:grid-cols-1">
            <Card>
              <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">14-day enquiry trend</p>
              <h2>Real requests by day</h2>
              <div className="grid min-h-32 grid-cols-[repeat(14,minmax(1.25rem,1fr))] items-end gap-1.5 overflow-x-auto pt-4 [&>div]:flex [&>div]:flex-col [&>div]:items-center [&>div]:justify-end [&>div]:gap-1 [&_i]:block [&_i]:min-h-[0.2rem] [&_i]:max-h-24 [&_i]:w-[70%] [&_i]:rounded-t-[0.3rem] [&_i]:bg-admin-accent [&_span]:[writing-mode:vertical-rl] [&_span]:text-[0.55rem] [&_span]:text-admin-ink-subtle [&_strong]:text-[0.65rem]">
                {query.data.data.enquiryTrend.map((point) => (
                  <div key={point.date}>
                    <span>
                      {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "short" },
                      )}
                    </span>
                    <i
                      style={{
                        height: `${Math.max(0.3, point.count) * 0.7}rem`,
                      }}
                    />
                    <strong>{point.count}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 [&_span]:rounded-full [&_span]:bg-admin-surface-muted [&_span]:px-2.5 [&_span]:py-1.5 [&_span]:text-[0.6rem] [&_span]:uppercase [&_b]:mr-1 [&_b]:text-admin-brand">
                {Object.entries(query.data.data.enquiryStatusCounts).map(
                  ([status, count]) => (
                    <span key={status}>
                      <b>{count}</b>
                      {status}
                    </span>
                  ),
                )}
              </div>
            </Card>
            <Card>
              <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">Activity queue</p>
              <h2>What needs attention now.</h2>
              <div className="grid [&_a]:flex [&_a]:items-center [&_a]:justify-between [&_a]:border-t [&_a]:border-admin-border-soft [&_a]:py-4 [&_a]:font-bold [&_a]:no-underline [&_a:hover]:text-admin-accent [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:border-0 [&_button]:border-t [&_button]:border-admin-border-soft [&_button]:bg-transparent [&_button]:py-4 [&_button]:text-left [&_button]:font-bold [&_button]:text-admin-ink [&_button.active]:text-admin-accent">
                {user?.role !== "SALES_AGENT" ? (
                  <Link to="/packages">
                    Manage package catalogue <span>→</span>
                  </Link>
                ) : null}
                {user?.role !== "CONTENT_EDITOR" ? (
                  <Link to="/enquiries">
                    Review new enquiries <span>→</span>
                  </Link>
                ) : null}
                {user?.role === "SUPER_ADMIN" ? (
                  <Link to="/users">
                    Manage staff access <span>→</span>
                  </Link>
                ) : null}
              </div>
              <p className="text-[0.7rem] text-admin-ink-subtle">
                Generated{" "}
                {new Date(query.data.data.generatedAt).toLocaleString("en-IN")}
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

export function EnvironmentPage() {
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Environment"
        description="Only browser-safe values are visible in this application."
      />
      <Card>
        <dl className="m-0 border-t border-admin-border-soft [&_div]:grid [&_div]:grid-cols-[12rem_1fr] [&_div]:gap-4 [&_div]:border-b [&_div]:border-admin-border-soft [&_div]:py-3.5 max-[680px]:[&_div]:grid-cols-1 [&_dt]:text-[0.78rem] [&_dt]:text-admin-ink-muted [&_dd]:m-0 [&_dd]:break-words [&_dd]:font-mono [&_dd]:text-[0.78rem]">
          <div>
            <dt>API base URL</dt>
            <dd>{env.apiBaseUrl}</dd>
          </div>
          <div>
            <dt>Public site URL</dt>
            <dd>{env.publicSiteUrl}</dd>
          </div>
          <div>
            <dt>Admin base path</dt>
            <dd>{import.meta.env.BASE_URL}</dd>
          </div>
        </dl>
        <p className="text-[0.7rem] text-admin-ink-subtle">
          Database credentials, SMTP secrets, session keys and reset tokens are
          never compiled into this client.
        </p>
      </Card>
    </>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  const { notify } = useToast();
  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const profile = useMutation({
    mutationFn: () =>
      apiRequest("/auth/profile", {
        method: "PUT",
        csrfToken: auth.csrfToken,
        body: { displayName },
      }),
    onSuccess: async () => {
      await auth.refresh();
      notify("Profile name updated.");
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  const password = useMutation({
    mutationFn: () => {
      if (newPassword.length < 14)
        throw new Error("Use at least 14 characters for the new password.");
      if (newPassword !== confirmation)
        throw new Error("New password confirmation does not match.");
      return apiRequest<void>("/auth/change-password", {
        method: "POST",
        csrfToken: auth.csrfToken,
        body: { currentPassword, newPassword },
      });
    },
    onSuccess: () => {
      window.location.assign(`${import.meta.env.BASE_URL}login`);
    },
    onError: (error) => notify(getErrorMessage(error), "error"),
  });
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Update your display name or securely change your password. A password change revokes every active session."
      />
      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <Card>
          <h2>Profile details</h2>
          <dl className="m-0 border-t border-admin-border-soft [&_div]:grid [&_div]:grid-cols-[12rem_1fr] [&_div]:gap-4 [&_div]:border-b [&_div]:border-admin-border-soft [&_div]:py-3.5 max-[680px]:[&_div]:grid-cols-1 [&_dt]:text-[0.78rem] [&_dt]:text-admin-ink-muted [&_dd]:m-0 [&_dd]:break-words [&_dd]:font-mono [&_dd]:text-[0.78rem]">
            <div>
              <dt>Email</dt>
              <dd>{auth.user?.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{auth.user?.role.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
              profile.mutate();
            }}
          >
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <Button
              disabled={profile.isPending || displayName.trim().length < 2}
              type="submit"
            >
              Save profile
            </Button>
          </form>
        </Card>
        <Card>
          <h2>Change password</h2>
          <form
            className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
            onSubmit={(event) => {
              event.preventDefault();
              password.mutate();
            }}
          >
            <label>
              Current password
              <input
                autoComplete="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              New password
              <input
                autoComplete="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <span className="text-[0.68rem] font-normal text-admin-ink-subtle">At least 14 characters.</span>
            </label>
            <label>
              Confirm new password
              <input
                autoComplete="new-password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <Button
              disabled={password.isPending || !currentPassword || !newPassword}
              type="submit"
            >
              Change password and sign out
            </Button>
          </form>
          <Link className="mt-5 inline-block text-[0.78rem] font-bold text-admin-brand hover:text-admin-accent" to="/forgot-password">
            Use email reset instead
          </Link>
        </Card>
      </div>
    </>
  );
}

export function ForbiddenPage() {
  return (
    <Card>
      <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">403</p>
      <h1>Access is not available.</h1>
      <p>
        Your signed-in role is not authorised for this section. If your
        responsibilities changed, ask a Super Admin to update your access.
      </p>
      <Link to="/">Return to overview</Link>
    </Card>
  );
}

export function NotFoundPage() {
  return (
    <Card>
      <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">404</p>
      <h1>Admin page not found.</h1>
      <p>The requested admin route does not exist.</p>
      <Link to="/">Return to overview</Link>
    </Card>
  );
}
