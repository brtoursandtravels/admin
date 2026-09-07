import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { env } from "./env";
import type { Role } from "./types";

type NavItem = { to: string; label: string; roles?: Role[] };
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "Workspace", items: [{ to: "/", label: "Overview" }] },
  {
    label: "Catalogue",
    items: [
      {
        to: "/packages",
        label: "Packages",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/destinations",
        label: "Destinations",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/categories",
        label: "Categories",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/media",
        label: "Media library",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/gallery",
        label: "Gallery albums",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
    ],
  },
  {
    label: "Website",
    items: [
      { to: "/blog", label: "Blog", roles: ["SUPER_ADMIN", "CONTENT_EDITOR"] },
      {
        to: "/content/pages",
        label: "Pages & policies",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/content/home",
        label: "Homepage",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/content/navigation",
        label: "Navigation",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/content/engagement",
        label: "FAQs & testimonials",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
      {
        to: "/content/settings",
        label: "Public settings",
        roles: ["SUPER_ADMIN", "CONTENT_EDITOR"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        to: "/enquiries",
        label: "Enquiries",
        roles: ["SUPER_ADMIN", "SALES_AGENT"],
      },
      {
        to: "/notifications",
        label: "Notifications",
        roles: ["SUPER_ADMIN", "SALES_AGENT"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "Staff users", roles: ["SUPER_ADMIN"] },
      { to: "/audit", label: "Audit trail", roles: ["SUPER_ADMIN"] },
      { to: "/profile", label: "My profile" },
      { to: "/system/environment", label: "Environment" },
    ],
  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role)),
      ),
    }))
    .filter((group) => group.items.length);

  return (
    <div className="grid min-h-screen grid-cols-[17.5rem_minmax(0,1fr)] max-[900px]:grid-cols-1">
      <aside
        className={`sticky top-0 z-30 flex h-screen flex-col overflow-y-auto bg-admin-brand-deep p-[1.35rem] text-admin-on-brand max-[900px]:fixed max-[900px]:left-0 max-[900px]:w-[88vw] max-[900px]:max-w-[19rem] max-[900px]:transition-transform ${
          menuOpen
            ? "max-[900px]:translate-x-0"
            : "max-[900px]:-translate-x-[105%]"
        }`}
      >
        <div className="flex items-center justify-between">
          <NavLink
            className="flex items-center text-white no-underline [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[11.5rem] [&_img]:object-contain"
            to="/"
            onClick={() => setMenuOpen(false)}
            aria-label="BR Tours admin home"
          >
            <img src={import.meta.env.BASE_URL + "br-logo.png"} alt="" />
          </NavLink>
          <button
            className="hidden border-0 bg-transparent text-[1.8rem] text-white max-[900px]:block"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>
        <nav className="mt-9 grid gap-4" aria-label="Admin sections">
          {visibleGroups.map((group) => (
            <div
              className="grid gap-1 [&_p]:my-1.5 [&_p]:px-3 [&_p]:text-[0.63rem] [&_p]:font-extrabold [&_p]:uppercase [&_p]:tracking-[0.14em] [&_p]:text-admin-on-brand-muted [&_a]:rounded-[0.55rem] [&_a]:px-3 [&_a]:py-2.5 [&_a]:text-[0.84rem] [&_a]:font-semibold [&_a]:no-underline [&_a:hover]:bg-admin-on-brand-hover [&_a:hover]:text-white"
              key={group.label}
            >
              <p>{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    isActive
                      ? "bg-admin-on-brand-hover! text-white!"
                      : ""
                  }
                  end={item.to === "/"}
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto grid border-t border-admin-on-brand-hover px-3 pt-5 [&_span]:text-[0.82rem] [&_span]:font-bold [&_span]:text-white [&_small]:mt-1 [&_small]:text-[0.64rem] [&_small]:uppercase [&_small]:text-admin-on-brand-muted">
          <span>{user?.displayName}</span>
          <small>{user?.role.replaceAll("_", " ")}</small>
        </div>
      </aside>
      {menuOpen ? (
        <button
          className="fixed inset-0 z-25 hidden border-0 bg-admin-overlay max-[900px]:block"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between border-b border-admin-border bg-admin-surface px-8 text-[0.78rem] max-[680px]:px-4">
          <button
            className="hidden border-0 bg-transparent text-[1.4rem] text-admin-brand max-[900px]:block"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div className="flex items-center gap-2 max-[680px]:hidden">
            <span className="h-2 w-2 rounded-full bg-admin-positive shadow-[0_0_0_4px_var(--color-admin-positive-soft)]" />
            Secure admin session
          </div>
          <div className="flex items-center gap-4 [&_a]:font-bold [&_a]:text-admin-brand [&_a]:no-underline [&_button]:border-0 [&_button]:bg-transparent [&_button]:font-bold [&_button]:text-admin-brand">
            <a
              className="max-[680px]:hidden"
              href={env.publicSiteUrl}
              target="_blank"
              rel="noreferrer"
            >
              View public site ↗
            </a>
            <button
              type="button"
              onClick={() => void logout().then(() => navigate("/login"))}
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[90rem] p-[clamp(1.4rem,4vw,3.25rem)] max-[680px]:px-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
