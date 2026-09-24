import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  FileStack,
  GalleryHorizontal,
  Gauge,
  Images,
  Inbox,
  LogOut,
  Menu,
  MessageSquareQuote,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ScrollText,
  ServerCog,
  Settings2,
  Tags,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, type DataResponse } from "./api";
import { useAuth } from "./auth";
import { env } from "./env";
import type { Role } from "./types";

type BadgeKey = "enquiries";
type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  badge?: BadgeKey;
};

const navItems: NavItem[] = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/packages", label: "Tour packages", icon: BookOpenText, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/categories", label: "Categories", icon: Tags, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/media", label: "Media library", icon: Images, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/gallery", label: "Gallery albums", icon: GalleryHorizontal, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/blog", label: "Blog", icon: FileStack, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/content/seo", label: "Page SEO", icon: Search, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/content/engagement", label: "FAQs & testimonials", icon: MessageSquareQuote, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/content/settings", label: "Public settings", icon: Settings2, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/enquiries", label: "Enquiries", icon: Inbox, roles: ["SUPER_ADMIN", "SALES_AGENT"], badge: "enquiries" },
  { to: "/users", label: "Staff users", icon: Users, roles: ["SUPER_ADMIN"] },
  { to: "/audit", label: "Activity logs", icon: ScrollText, roles: ["SUPER_ADMIN"] },
  { to: "/profile", label: "My profile", icon: CircleUserRound },
  { to: "/system/environment", label: "Environment", icon: ServerCog },
];

const quickActions: Array<{ to: string; label: string; icon: LucideIcon; roles: Role[] }> = [
  { to: "/packages/new", label: "New package", icon: BookOpenText, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/blog/new", label: "New blog article", icon: FileStack, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
  { to: "/media/new", label: "Upload media", icon: Images, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
];

type ShellDashboard = { newEnquiries: number };

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DataResponse<ShellDashboard>>("/admin/dashboard"),
    staleTime: 30_000,
  });
  const allNavigation = useMemo(
    () => navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role))),
    [user],
  );
  const visibleActions = useMemo(
    () => quickActions.filter((action) => user && action.roles.includes(user.role)),
    [user],
  );
  const currentItem = useMemo(
    () =>
      [...allNavigation]
        .sort((left, right) => right.to.length - left.to.length)
        .find((item) =>
          item.to === "/"
            ? location.pathname === "/"
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
        ) ?? allNavigation[0],
    [allNavigation, location.pathname],
  );
  const routeContext = location.pathname.endsWith("/new")
    ? "Create new"
    : location.pathname.endsWith("/edit")
      ? "Edit"
      : location.pathname.endsWith("/preview")
        ? "Preview"
        : "Workspace";
  const filteredCommands = useMemo(() => {
    const term = commandQuery.trim().toLowerCase();
    if (!term) return allNavigation;
    return allNavigation.filter((item) => item.label.toLowerCase().includes(term));
  }, [allNavigation, commandQuery]);
  const badges: Record<BadgeKey, number> = {
    enquiries: dashboard.data?.data.newEnquiries ?? 0,
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setCreateOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [commandOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const signOut = () => void logout().then(() => navigate("/login"));
  const openCommand = () => {
    setCommandQuery("");
    setCommandOpen(true);
  };

  return (
    <div className={`min-h-screen bg-admin-canvas transition-[grid-template-columns] duration-300 lg:grid ${collapsed ? "lg:grid-cols-[5rem_minmax(0,1fr)]" : "lg:grid-cols-[17.5rem_minmax(0,1fr)]"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,17.5rem)] min-w-0 flex-col overflow-hidden border-r border-white/8 bg-admin-brand-deep text-admin-on-brand shadow-2xl transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${collapsed ? "lg:w-20" : "lg:w-auto"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex min-h-20 items-center border-b border-white/8 ${collapsed ? "lg:justify-center lg:px-2" : "justify-between px-5"}`}>
          <NavLink
            aria-label="BR Tours admin home"
            className="flex min-w-0 items-center no-underline"
            onClick={() => setMenuOpen(false)}
            to="/"
          >
            {collapsed ? (
              <span className="hidden size-11 items-center justify-center rounded-2xl bg-admin-accent text-sm font-black tracking-[0.08em] text-white lg:flex">BR</span>
            ) : null}
            <img className={`h-auto w-full max-w-[10.75rem] object-contain ${collapsed ? "lg:hidden" : ""}`} src={`${import.meta.env.BASE_URL}br-logo.png`} alt="BR Tours & Travels" />
          </NavLink>
          <button
            aria-label="Close navigation"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white transition hover:bg-white/12 lg:hidden"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Admin sections" className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-5 ${collapsed ? "lg:px-2" : "px-3"}`}>
          <ul className="m-0 grid list-none gap-1 p-0">
            {allNavigation.map((item) => {
              const Icon = item.icon;
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <li key={item.to}>
                  <NavLink
                    aria-label={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-bold no-underline transition duration-200 ${collapsed ? "lg:justify-center lg:px-2" : ""} ${isActive ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]" : "text-admin-on-brand hover:bg-white/7 hover:text-white"}`
                    }
                    end={item.to === "/"}
                    onClick={() => setMenuOpen(false)}
                    title={collapsed ? item.label : undefined}
                    to={item.to}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`absolute inset-y-2 left-0 w-0.5 rounded-full transition ${isActive ? "bg-admin-accent" : "bg-transparent"}`} />
                        <Icon className={isActive ? "text-admin-accent-light" : "text-admin-on-brand-muted group-hover:text-white"} size={18} strokeWidth={1.9} aria-hidden="true" />
                        <span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                        {count > 0 ? (
                          <span className={`${collapsed ? "absolute top-0.5 right-0.5 lg:flex" : ""} inline-flex min-w-5 items-center justify-center rounded-full bg-admin-accent px-1.5 py-0.5 text-[0.6rem] font-black text-white`}>
                            {count > 99 ? "99+" : count}
                          </span>
                        ) : null}
                        <ChevronRight className={`transition ${collapsed ? "lg:hidden" : ""} ${isActive ? "translate-x-0 opacity-70" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"}`} size={15} aria-hidden="true" />
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/8 p-3">
          <NavLink className={`flex min-w-0 items-center gap-3 rounded-xl bg-white/6 p-3 no-underline transition hover:bg-white/10 ${collapsed ? "lg:justify-center lg:p-2" : ""}`} to="/profile" onClick={() => setMenuOpen(false)} title={collapsed ? user?.displayName : undefined}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-sm font-black text-white">
              {(user?.displayName ?? "A").slice(0, 1).toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <strong className="block truncate text-[0.82rem] text-white">{user?.displayName}</strong>
              <small className="mt-0.5 block truncate text-[0.65rem] font-bold uppercase tracking-[0.08em] text-admin-on-brand-muted">
                {user?.role.replaceAll("_", " ")}
              </small>
            </span>
          </NavLink>
        </div>
      </aside>

      {menuOpen ? (
        <button aria-label="Close navigation" className="fixed inset-0 z-40 border-0 bg-admin-overlay backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} type="button" />
      ) : null}

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-admin-border/80 bg-admin-surface/92 px-4 shadow-[0_1px_0_rgb(15_23_42/0.02)] backdrop-blur-xl sm:px-7 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Open navigation" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-brand shadow-sm transition hover:bg-admin-brand-soft lg:hidden" onClick={() => setMenuOpen(true)} type="button">
              <Menu size={20} aria-hidden="true" />
            </button>
            <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-brand shadow-sm transition hover:bg-admin-brand-soft lg:inline-flex" onClick={() => setCollapsed((value) => !value)} type="button">
              {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-[0.7rem] font-bold text-admin-ink-subtle">
                <li><Link className="text-admin-ink-subtle no-underline hover:text-admin-brand" to="/">Admin</Link></li>
                <li aria-hidden="true"><ChevronRight size={12} /></li>
                <li className="truncate">
                  {routeContext === "Workspace" ? (
                    <span aria-current="page">{currentItem?.label ?? "Workspace"}</span>
                  ) : (
                    <Link className="text-admin-ink-subtle no-underline hover:text-admin-brand" to={currentItem?.to ?? "/"}>{currentItem?.label}</Link>
                  )}
                </li>
                {routeContext !== "Workspace" ? <><li aria-hidden="true"><ChevronRight size={12} /></li><li className="text-admin-brand-deep" aria-current="page">{routeContext}</li></> : null}
              </ol>
              <strong className="mt-0.5 block truncate text-[0.94rem] text-admin-brand-deep">{currentItem?.label ?? "Workspace"}</strong>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button className="hidden min-h-10 w-[clamp(10rem,20vw,18rem)] items-center gap-2 rounded-xl border border-admin-border bg-admin-canvas px-3 text-left text-[0.76rem] font-bold text-admin-ink-subtle transition hover:border-admin-brand/25 hover:bg-admin-brand-soft md:flex" onClick={openCommand} type="button">
              <Search size={16} aria-hidden="true" />
              <span className="flex-1">Search or jump to…</span>
              <kbd className="rounded-md border border-admin-border bg-white px-1.5 py-0.5 text-[0.62rem]">Ctrl K</kbd>
            </button>
            <button aria-label="Search admin" className="inline-flex size-10 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-brand md:hidden" onClick={openCommand} type="button"><Search size={17} /></button>
            {visibleActions.length ? (
              <div className="relative">
                <button aria-expanded={createOpen} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-admin-brand px-3 text-[0.78rem] font-black text-white shadow-sm transition hover:bg-admin-brand-deep" onClick={() => { setCreateOpen((open) => !open); setProfileOpen(false); }} type="button">
                  <Plus size={16} aria-hidden="true" /><span className="max-[720px]:hidden">Create</span><ChevronDown className="max-[720px]:hidden" size={14} />
                </button>
                {createOpen ? (
                  <div className="admin-popover absolute top-[calc(100%+0.55rem)] right-0 w-56 overflow-hidden rounded-2xl border border-admin-border bg-white p-2">
                    <p className="m-0 px-3 py-2 text-[0.64rem] font-black uppercase tracking-[0.12em] text-admin-ink-subtle">Create new</p>
                    {visibleActions.map((action) => { const Icon = action.icon; return <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8rem] font-bold text-admin-brand-deep no-underline hover:bg-admin-brand-soft" key={action.to} onClick={() => setCreateOpen(false)} to={action.to}><Icon size={17} className="text-admin-brand" />{action.label}</Link>; })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <a aria-label="View public site" className="hidden min-h-10 items-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-[0.78rem] font-bold text-admin-brand no-underline transition hover:border-admin-brand/25 hover:bg-admin-brand-soft xl:inline-flex" href={env.publicSiteUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" /><span>Live site</span><span className="rounded-full bg-admin-positive-soft px-1.5 py-0.5 text-[0.58rem] uppercase text-admin-positive">Open</span>
            </a>
            <div className="relative">
              <button aria-expanded={profileOpen} aria-label="Open profile menu" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-admin-border bg-white px-2 text-admin-brand transition hover:bg-admin-brand-soft" onClick={() => { setProfileOpen((open) => !open); setCreateOpen(false); }} type="button">
                <span className="flex size-7 items-center justify-center rounded-lg bg-admin-accent text-[0.7rem] font-black text-white">{(user?.displayName ?? "A").slice(0, 1).toUpperCase()}</span>
                <ChevronDown className="hidden sm:block" size={14} />
              </button>
              {profileOpen ? (
                <div className="admin-popover absolute top-[calc(100%+0.55rem)] right-0 w-64 overflow-hidden rounded-2xl border border-admin-border bg-white p-2">
                  <div className="border-b border-admin-border-soft px-3 py-2.5"><strong className="block truncate text-[0.82rem] text-admin-brand-deep">{user?.displayName}</strong><small className="text-[0.68rem] uppercase text-admin-ink-subtle">{user?.role.replaceAll("_", " ")}</small></div>
                  <Link className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8rem] font-bold text-admin-brand-deep no-underline hover:bg-admin-brand-soft" onClick={() => setProfileOpen(false)} to="/profile"><CircleUserRound size={17} />Profile</Link>
                  {user?.role !== "SALES_AGENT" ? <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8rem] font-bold text-admin-brand-deep no-underline hover:bg-admin-brand-soft" onClick={() => setProfileOpen(false)} to="/content/settings"><Settings2 size={17} />Settings</Link> : null}
                  <button className="flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-[0.8rem] font-bold text-admin-negative hover:bg-admin-negative-soft" onClick={signOut} type="button"><LogOut size={17} />Sign out</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[100rem] p-[clamp(1.25rem,3vw,2.75rem)]"><Outlet /></div>
      </main>

      {commandOpen ? (
        <div className="admin-dialog-backdrop fixed inset-0 z-[150] flex items-start justify-center bg-admin-overlay p-4 pt-[max(5rem,12vh)] backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setCommandOpen(false); }}>
          <div aria-label="Admin command search" aria-modal="true" className="admin-dialog-panel w-full max-w-xl overflow-hidden rounded-3xl border border-white/60 bg-white shadow-admin-dialog" role="dialog">
            <div className="flex items-center gap-3 border-b border-admin-border px-5"><Search className="text-admin-brand" size={20} /><input aria-label="Search admin sections" className="min-h-16 flex-1 border-0 bg-transparent text-base text-admin-ink outline-none" onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search pages and actions…" ref={searchRef} value={commandQuery} /><button aria-label="Close search" className="inline-flex size-9 items-center justify-center rounded-xl border-0 bg-admin-surface-muted text-admin-ink-muted" onClick={() => setCommandOpen(false)} type="button"><X size={17} /></button></div>
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
              {filteredCommands.length ? filteredCommands.map((item) => { const Icon = item.icon; return <Link className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-admin-brand-deep no-underline hover:bg-admin-brand-soft" key={item.to} onClick={() => setCommandOpen(false)} to={item.to}><span className="flex size-10 items-center justify-center rounded-xl bg-admin-surface-muted text-admin-brand group-hover:bg-white"><Icon size={19} /></span><span className="flex-1 text-[0.88rem] font-black">{item.label}</span><ChevronRight size={16} className="text-admin-ink-subtle" /></Link>; }) : <p className="p-8 text-center text-sm text-admin-ink-muted">No admin sections match “{commandQuery}”.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-admin-border-soft bg-admin-surface-muted px-5 py-3 text-[0.68rem] text-admin-ink-subtle"><span>Navigate with search</span><span>Esc to close</span></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
