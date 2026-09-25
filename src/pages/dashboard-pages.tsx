import { useQuery } from "@tanstack/react-query";
import {
  BookOpenText,
  CalendarDays,
  FileText,
  Inbox,
  Plus,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest, type DataResponse } from "../api";
import { useAuth } from "../auth";
import {
  Card,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
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
