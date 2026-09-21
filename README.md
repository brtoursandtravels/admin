# BR Tours and Travels admin

Independent React 19 + Vite 8 administration application. It is mounted at
`/admin/`; Vite's base, React Router's basename and the supplied Nginx fallback
all preserve nested-route refreshes.

Vercel serves the build's public files at the root. Keep the explicit
`/admin/br-logo.png` and `/admin/favicon.png` rewrites before the admin SPA
fallback so both login logos and the sidebar logo receive images, not HTML.
Authenticated session restoration uses the user included in `/auth/csrf`, with
an `/auth/me` fallback for older API deployments.

Package tables and relation selectors request `/admin/packages?view=summary`;
edit, preview and duplication continue to load the full individual package.
Blog and gallery editor libraries load when the editor opens. Deploy the API
before this admin version so the compact package response is available.

The application is connected to the Express API and includes session login,
password reset/profile management, role-based navigation and route guards,
live dashboard analytics, package/taxonomy/media/gallery management, the page
and blog CMS, homepage/navigation/settings management, enquiry operations,
notification retry, user administration and audit logs. Draft previews remain
authenticated and carry no public preview bypass.

## Theme and Tailwind

Tailwind CSS 4 is compiled through `@tailwindcss/vite`. `src/globals.css` is the
single theme source for brand, neutral, status, focus, shadow and typography
tokens plus global element defaults. `src/styles.css` contains component/layout
rules and consumes those variables; it does not define independent colours.

## Environment

- `.env.local` contains local browser-safe settings.

Only `VITE_`-prefixed public values belong here. Database, SMTP, storage and
session secrets belong only in the API project.

## Commands

    npm install
    npm run dev
    npm run lint
    npm run typecheck
    npm run build
    npm run preview

All dependencies and environment files are local to this folder and use npm;
the workspace root is not a package.

See `ADMIN_USER_GUIDE.md` for role boundaries, publication, media, enquiry and
account workflows.

## Media previews

All package, destination, gallery, blog and media-library previews use the
authenticated `/api/v1/admin/media/:id/file` endpoint. On Vercel, the API redirects
public seeded images to `/media/seed/...` because those files are deployed as
static assets rather than stored in the function's runtime media directory.
Both `vercel.json` and the Vite development proxy must therefore forward
`/api/v1/...` and `/media/...` to the API on the same browser origin.

Deploy the API and admin changes together when changing this routing. Private
media and ordinary uploads continue through the authenticated file endpoint;
they are not made public by this redirect. Uploaded files still require
persistent runtime storage. The API's `npm run test:media` checks the seeded-image
redirect, local delivery and media-access boundaries.
