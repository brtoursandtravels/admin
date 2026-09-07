# BR Tours and Travels admin

Independent React 19 + Vite 8 administration application. It is mounted at
`/admin/`; Vite's base, React Router's basename and the supplied Nginx fallback
all preserve nested-route refreshes.

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
