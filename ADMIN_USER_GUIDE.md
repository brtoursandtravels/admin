# BR Tours and Travels admin user guide

Open `/admin/` on the production domain. There is no public signup. A Super
Admin creates staff accounts, and the first administrator is created with the
API project's interactive `npm run admin:create` command.

## Roles

- **Super Admin** manages all content, enquiries, settings, audit records and
  staff. The final active Super Admin cannot be disabled or demoted.
- **Content Editor** manages catalogue, pages, media, gallery, journal,
  homepage, FAQs, testimonials and navigation. They cannot read enquiries or
  manage staff.
- **Sales Agent** manages enquiries, assignment, notes and status history. They
  cannot publish content or manage users.

The API enforces these rules even if a user manually calls a hidden endpoint.

## Daily content workflow

1. Upload an authorized image in **Media** with meaningful alt text, source and
   rights notes. PDFs are for brochures; SVG, HTML and executable files are
   rejected.
2. Create or duplicate a package in **Packages**. Complete its summary,
   destinations/categories, price basis, itinerary, departures, inclusions,
   exclusions, transport, policy notes, media order, SEO and optional brochure.
3. Save as **Draft**, use the authenticated preview, then publish. Public edits
   appear on the next navigation/refresh without rebuilding the frontend.
4. Unpublish or archive content that should disappear. Do not use a public
   `?preview=true` URL; it never reveals drafts.

To change only an image, upload the replacement as **Public** media first. For
a place card, open **Destinations**, edit the destination, and choose its
**Place cover image**. For a package, open **Packages**, select the **Media**
tab, add the image, choose the cover image if needed, and save. Phone numbers,
addresses and departure dates do not need to be re-entered when only an image
is changing.

Use **Homepage** to reorder the supported finite sections and change visibility.
Use **Pages** for About and policies, **Settings** for only confirmed public
business/contact facts, **Navigation** for menus/footer links, and **FAQs** or
**Testimonials** for approved records. For each testimonial, add the public
name and quote, then optionally add the traveller location, trip name, rating,
display order and publish date. Record consent evidence before selecting
**Approved for public display**. Only approved, published testimonials appear
on the public website; drafts, archived records and unapproved testimonials
remain hidden.

Journal articles accept sanitized rich content, a public author identity, tags,
SEO, related articles and related packages. Never paste scripts, templates,
login emails or private customer information into public content.

## Delete content

Use **Delete** beside an entry, check its name in the confirmation dialog, then
confirm. **Cancel** or Escape leaves it unchanged. The list refreshes after a
successful deletion; failures stay in the dialog so you can retry.

Deleting a package also removes its itinerary, departures and package FAQs.
Customer enquiry history and shared media files remain. Deleting an album or
article keeps its image files in the Media library. In-use files must be unlinked
before deleting them from Media. Archive remains available when you want to
retain the entry for later use.

**Remove** inside an editor changes that form only: save the package or album
to persist removed days, departures or images. Blog categories and tags can be
deleted under **Manage categories and tags**. Page SEO's **Reset** removes saved
meta tags and restores the page defaults.

The public site refreshes cached content on subsequent visits. Refresh an
already open page to see the change; cache refresh can take roughly a minute.
Deleted starter content is not recreated by later deployments.

## Enquiries

An enquiry is a lead, not a paid or guaranteed reservation. Search and filter in
**Enquiries**, assign an authorized staff member, add internal notes, and record
status changes. `CONFIRMED` is a staff status only. CSV export is protected and
spreadsheet-active values are escaped.

The detail screen shows notification delivery state. Retry a failed notification
only after correcting SMTP/connectivity; retrying does not create another lead.
Never tell a visitor that queued mail has been delivered.

## Account and safety

Use **Profile** to update your display name or change your password. Password
changes and resets revoke existing sessions. Sign out on shared devices. If all
access is lost, an operator runs the owner-controlled bootstrap/reset procedure;
there is no default production password.

Unsaved-change warnings and destructive confirmations are deliberate. Resolve
validation errors rather than bypassing them, verify public changes in a new
browser session, and report unexpected permission or media exposure immediately.
