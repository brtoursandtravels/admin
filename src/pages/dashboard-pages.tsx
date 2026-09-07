import { useMutation, useQuery } from "@tanstack/react-query";
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
  failedNotifications: number;
  draftPosts: number;
  publishedPosts: number;
  enquiryStatusCounts: Record<string, number>;
  enquiryTrend: Array<{ date: string; count: number }>;
  generatedAt: string;
};

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DataResponse<Dashboard>>("/admin/dashboard"),
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
          <div className="mb-4 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1 [&_article]:grid [&_article]:rounded-[0.9rem] [&_article]:border [&_article]:border-admin-border [&_article]:bg-admin-surface [&_article]:p-5 [&_article]:shadow-admin-card [&_span]:text-[0.74rem] [&_span]:font-bold [&_span]:text-admin-ink-muted [&_strong]:my-1.5 [&_strong]:font-display [&_strong]:text-[2.55rem] [&_strong]:font-medium [&_strong]:text-admin-brand [&_small]:text-[0.7rem] [&_small]:text-admin-ink-subtle">
            <article>
              <span>All active packages</span>
              <strong>{query.data.data.packages}</strong>
              <small>
                {query.data.data.publishedPackages} currently published
              </small>
            </article>
            <article>
              <span>New enquiries</span>
              <strong>{query.data.data.newEnquiries}</strong>
              <small>Awaiting first response</small>
            </article>
            <article>
              <span>Upcoming departures</span>
              <strong>{query.data.data.upcomingDepartures}</strong>
              <small>Scheduled future request options</small>
            </article>
            <article>
              <span>Published articles</span>
              <strong>{query.data.data.publishedPosts}</strong>
              <small>{query.data.data.draftPosts} drafts remain private</small>
            </article>
            <article>
              <span>Failed notifications</span>
              <strong>{query.data.data.failedNotifications}</strong>
              <small>Review delivery and retry safely</small>
            </article>
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
              <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">Quick work</p>
              <h2>Continue where attention is needed.</h2>
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
