# BR Tours and Travels admin

Independent React 19 + Vite 8 administration application. It is mounted at
`/admin/`; Vite's base, React Router's basename and the supplied Nginx fallback
all preserve nested-route refreshes.

Vercel serves the build's public files at the root. Keep the explicit
`/admin/br-logo.png` and `/admin/favicon.png` rewrites before the admin SPA
fallback so both login logos and the sidebar logo receive images, not HTML.
Authenticated session restoration uses the user and public site URL included in
`/auth/csrf`, with an `/auth/me` fallback for older API deployments.

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

- Create an ignored `.env.local` and set `API_PROXY_TARGET` to the local API
  origin (usually `http://localhost:4000`). Vite uses it only to proxy `/api/v1`
  and `/media` while developing.
- Browser API calls always use `/api/v1`. On Vercel, `vercel.json` routes those
  calls to the API. The API returns its `PUBLIC_SITE_URL` in `/auth/csrf` for
  links to public packages and articles.

Keep database, SMTP, storage, session and deployment credentials in their
respective server or deployment settings, not in admin environment files.

## Reusable delete actions

`src/components/DeleteButton.tsx` exports `DeleteButton` for local editor rows and
`DeleteRecordButton` for saved content. The latter owns the authenticated request,
pending state, error dialog, cache invalidation and success feedback. Pages supply
only a resource label, record name, endpoint and affected query keys.

Saved entries require confirmation before permanent deletion. Archive remains a
separate action. Removing an itinerary day, departure or gallery image edits the
form only; save its parent package/album to persist the change. Cancel and Escape
do not send a request, and Enter activates only the focused dialog button.

Run `npm run test:delete-ui` for mocked browser checks. Install its browser once
with `npx playwright install chromium`. Tests start a local Vite server on port
5192 and intercept every API request; they never delete production records.
Set `DELETE_TEST_BASE_URL` to test the deployed UI with the same simulated API
responses instead of starting Vite.

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
