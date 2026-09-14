import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpenText,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  FileStack,
  GalleryHorizontal,
  Gauge,
  Images,
  Inbox,
  LayoutPanelTop,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareQuote,
  Navigation,
  ScrollText,
  ServerCog,
  Settings2,
  Tags,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { env } from "./env";
import type { Role } from "./types";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [{ to: "/", label: "Overview", icon: Gauge }],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/packages", label: "Tour packages", icon: BookOpenText, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/destinations", label: "Destinations", icon: MapPinned, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/categories", label: "Categories", icon: Tags, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/media", label: "Media library", icon: Images, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/gallery", label: "Gallery albums", icon: GalleryHorizontal, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
    ],
  },
  {
    label: "Website",
    items: [
      { to: "/blog", label: "Blog", icon: FileStack, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/content/pages", label: "Pages & policies", icon: ScrollText, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/content/home", label: "Homepage", icon: LayoutPanelTop, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/content/navigation", label: "Navigation", icon: Navigation, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/content/engagement", label: "FAQs & testimonials", icon: MessageSquareQuote, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      { to: "/content/settings", label: "Public settings", icon: Settings2, roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/enquiries", label: "Enquiries", icon: Inbox, roles: ["SUPER_ADMIN", "SALES_AGENT"] },
      { to: "/notifications", label: "Notifications", icon: Bell, roles: ["SUPER_ADMIN", "SALES_AGENT"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "Staff users", icon: Users, roles: ["SUPER_ADMIN"] },
      { to: "/audit", label: "Audit trail", icon: ScrollText, roles: ["SUPER_ADMIN"] },
      { to: "/profile", label: "My profile", icon: CircleUserRound },
      { to: "/system/environment", label: "Environment", icon: ServerCog },
    ],
  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          ),
        }))
        .filter((group) => group.items.length),
    [user],
  );
  const currentItem = useMemo(() => {
    const candidates = visibleGroups.flatMap((group) => group.items);
    return (
      [...candidates]
        .sort((left, right) => right.to.length - left.to.length)
        .find((item) =>
          item.to === "/"
            ? location.pathname === "/"
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
        ) ?? candidates[0]
    );
  }, [location.pathname, visibleGroups]);
  const routeContext = location.pathname.endsWith("/new")
    ? "Create new"
    : location.pathname.endsWith("/edit")
      ? "Edit record"
      : "Workspace";

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-admin-canvas lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,17.5rem)] min-w-0 flex-col overflow-hidden border-r border-white/8 bg-admin-brand-deep text-admin-on-brand shadow-2xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-20 items-center justify-between border-b border-white/8 px-5">
          <NavLink
            className="flex min-w-0 items-center no-underline [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[10.75rem] [&_img]:object-contain"
            to="/"
            onClick={() => setMenuOpen(false)}
            aria-label="BR Tours admin home"
          >
            <img src={`${import.meta.env.BASE_URL}br-logo.png`} alt="BR Tours & Travels" />
          </NavLink>
          <button
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white transition hover:bg-white/12 lg:hidden"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-5" aria-label="Admin sections">
          {visibleGroups.map((group) => (
            <div className="mb-6 last:mb-0" key={group.label}>
              <p className="mb-2 px-3 text-[0.68rem] font-black uppercase tracking-[0.15em] text-admin-on-brand-muted">
                {group.label}
              </p>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      className={({ isActive }) =>
                        `group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-bold no-underline transition duration-200 ${
                          isActive
                            ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]"
                            : "text-admin-on-brand hover:bg-white/7 hover:text-white"
                        }`
                      }
                      end={item.to === "/"}
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`absolute inset-y-2 left-0 w-0.5 rounded-full transition ${isActive ? "bg-admin-accent" : "bg-transparent"}`} />
                          <Icon className={isActive ? "text-admin-accent-light" : "text-admin-on-brand-muted group-hover:text-white"} size={18} strokeWidth={1.9} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <ChevronRight className={`transition ${isActive ? "translate-x-0 opacity-70" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"}`} size={15} aria-hidden="true" />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-3">
          <NavLink className="flex min-w-0 items-center gap-3 rounded-xl bg-white/6 p-3 no-underline transition hover:bg-white/10" to="/profile" onClick={() => setMenuOpen(false)}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-sm font-black text-white">
              {(user?.displayName ?? "A").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[0.82rem] text-white">{user?.displayName}</strong>
              <small className="mt-0.5 block truncate text-[0.65rem] font-bold uppercase tracking-[0.08em] text-admin-on-brand-muted">
                {user?.role.replaceAll("_", " ")}
              </small>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </NavLink>
        </div>
      </aside>

      {menuOpen ? (
        <button
          className="fixed inset-0 z-40 border-0 bg-admin-overlay backdrop-blur-sm lg:hidden"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-admin-border/80 bg-admin-surface/92 px-5 shadow-[0_1px_0_rgb(15_23_42/0.02)] backdrop-blur-xl sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-brand shadow-sm transition hover:bg-admin-brand-soft lg:hidden"
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5 text-[0.7rem] font-bold text-admin-ink-subtle">
                <span>Admin</span>
                <ChevronRight size={12} aria-hidden="true" />
                <span className="truncate">{routeContext}</span>
              </div>
              <strong className="mt-0.5 block truncate text-[0.94rem] text-admin-brand-deep">
                {currentItem?.label ?? "Workspace"}
              </strong>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-[0.78rem] font-bold text-admin-brand no-underline transition hover:border-admin-brand/25 hover:bg-admin-brand-soft max-[560px]:size-10 max-[560px]:justify-center max-[560px]:px-0"
              href={env.publicSiteUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View public site"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span className="max-[560px]:hidden">View site</span>
            </a>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-3 text-[0.78rem] font-bold text-admin-ink-muted transition hover:bg-admin-negative-soft hover:text-admin-negative max-[560px]:size-10 max-[560px]:justify-center max-[560px]:px-0"
              type="button"
              onClick={() => void logout().then(() => navigate("/login"))}
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="max-[560px]:hidden">Sign out</span>
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[100rem] p-[clamp(1.25rem,3vw,2.75rem)]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
