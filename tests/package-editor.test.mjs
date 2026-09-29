import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "http://127.0.0.1:5194";
let vite, browser;
before(async () => {
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, API_PROXY_TARGET: "" } });
  for (let i = 0; i < 120; i++) { if (await fetch(`${base}/admin/`).then(r => r.ok).catch(() => false)) break; await delay(250); }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });
const media = (id, mimeType = "image/webp") => ({ id, mimeType, url: `/media/${id}`, originalName: `${id}.${mimeType === "application/pdf" ? "pdf" : "webp"}`, altText: `Travel ${id}`, caption: null, width: 800, height: 600, sizeBytes: "12000", visibility: "PUBLIC", sourceNotes: null, licenseNotes: null, provider: "LOCAL", createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" });
const fixture = {
  id: "test-package", title: "Mountain journey", slug: "mountain-journey", status: "DRAFT", days: 2, nights: 1, summary: "A peaceful mountain journey.", overview: "Explore mountain landscapes with your local guide.",
  basePrice: "2500", currency: "INR", priceBasis: "PER_PERSON", startingCity: "Delhi", highlights: ["Mountain views"], inclusions: ["Hotels"], exclusions: ["Flights"], destinations: [], categories: [], isDemo: false, isFeatured: false, featuredOrder: null, publishedAt: null,
  itinerary: [1, 2].map(dayNumber => ({ dayNumber, title: `Day ${dayNumber}`, description: "Explore the mountains.", activities: [], meals: "Breakfast", accommodation: "Hill lodge", imageMediaId: null })), departures: [], media: [{ ...media("cover"), isCover: true, sortOrder: 0 }], brochure: null,
};
const categoryMaster = [
  { id: "adventure", slug: "adventure", name: "Adventure", status: "PUBLISHED" },
  { id: "cultural", slug: "cultural", name: "Cultural tours", status: "PUBLISHED" },
  { id: "retired", slug: "retired", name: "Retired category", status: "ARCHIVED" },
];
async function setup(t, create = false, recordOverrides = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  t.after(() => context.close());
  const state = { record: structuredClone({ ...fixture, ...recordOverrides }), assets: new Map([media("cover"), media("extra"), media("brochure", "application/pdf"), ...(recordOverrides.media ?? [])].map(asset => [asset.id, asset])), writes: [], errors: [], failUpload: false, uploadGate: null };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() !== "GET") state.writes.push({ path, method: request.method(), csrf: request.headers()["x-csrf-token"], body: request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", publicSiteUrl: base, authenticated: true, user: { id: "test-admin", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (path === "/admin/categories") return json({ data: categoryMaster });
    if (path === "/admin/media" && request.method() === "POST") {
      if (state.uploadGate) await state.uploadGate;
      if (state.failUpload) return json({ error: { code: "UPLOAD_FAILED", message: "Upload failed. Retry." } }, 500);
      const fields = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
      const altText = String(fields.get("altText") ?? "").trim();
      if (altText.length < 2 || altText.length > 300) return json({ error: { code: "VALIDATION_FAILED", message: "Alternative text must contain 2–300 characters." } }, 400);
      const asset = { ...media(`uploaded-${state.assets.size}`, fields.get("file").type === "application/pdf" ? "application/pdf" : "image/webp"), altText, caption: fields.get("caption") || null, visibility: fields.get("visibility"), sourceNotes: fields.get("sourceNotes") || null, licenseNotes: fields.get("licenseNotes") || null };
      state.assets.set(asset.id, asset); return json({ data: asset }, 201);
    }
    if (path === "/admin/media") { const data = [...state.assets.values()].filter(asset => url.searchParams.get("kind") === "pdf" ? asset.mimeType === "application/pdf" : asset.mimeType.startsWith("image/")); return json({ data, meta: { page: 1, pageSize: 24, total: data.length } }); }
    if (/^\/admin\/media\/[^/]+\/file$/.test(path)) return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
    if (path.startsWith("/admin/media/")) { const id = path.split("/").at(-1); if (request.method() === "PATCH") state.assets.set(id, { ...state.assets.get(id), ...request.postDataJSON() }); return json({ data: state.assets.get(id) }); }
    if (path === "/admin/packages/test-package" || (path === "/admin/packages" && request.method() === "POST")) {
      if (request.method() !== "GET") { const body = request.postDataJSON(); state.record = { ...state.record, ...body, id: "test-package", media: body.media.map(item => ({ ...state.assets.get(item.mediaAssetId), ...item })), brochure: state.assets.get(body.brochureMediaId) ?? null, destinations: body.destinationNames.map(name => ({ id: name, name, slug: name.toLowerCase() })), categories: categoryMaster.filter(item => body.categoryIds.includes(item.id)) }; }
      return json({ data: state.record });
    }
    return json({ data: [], meta: { page: 1, pageSize: 25, total: 0 } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message)); page.on("dialog", dialog => { state.errors.push(`Native dialog: ${dialog.type()}`); void dialog.dismiss(); });
  await page.goto(`${base}/admin/packages/${create ? "new" : "test-package/edit"}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("tab", { name: /Basics/ }).waitFor();
  return { page, state };
}
test("wizard validates basics, syncs slug/duration and saves an incomplete draft", async t => {
  const { page, state } = await setup(t, true);
  await page.getByRole("button", { name: "Next: Content", exact: true }).click();
  assert.equal(await page.getByRole("tab", { name: /Basics/ }).getAttribute("aria-selected"), "true");
  await page.getByLabel("Title", { exact: true }).fill("Gangtok & Darjeeling Explorer");
  assert.equal(await page.getByLabel("URL slug", { exact: true }).inputValue(), "gangtok-darjeeling-explorer");
  await page.getByLabel("Days", { exact: true }).fill("6");
  assert.equal(await page.getByLabel("Nights", { exact: true }).inputValue(), "5");
  await page.getByLabel("Nights", { exact: true }).fill("4");
  await page.getByLabel("Days", { exact: true }).fill("7");
  assert.equal(await page.getByLabel("Nights", { exact: true }).inputValue(), "4");
  await page.getByRole("radio", { name: "Adventure published", exact: true }).check();
  await page.getByRole("textbox", { name: "Destinations", exact: true }).fill("Gangtok");
  await page.getByRole("button", { name: "Save as draft", exact: true }).click();
  await page.waitForURL("**/packages/test-package/edit");
  const write = state.writes.find(item => item.path === "/admin/packages");
  assert.equal(write.body.status, "DRAFT"); assert.deepEqual(write.body.destinationNames, ["Gangtok"]); assert.deepEqual(write.body.categoryIds, ["adventure"]); assert.equal(write.csrf, "test-csrf");
  await page.reload();
  await page.getByRole("textbox", { name: "Destinations", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Destinations", exact: true }).inputValue(), "Gangtok");
  assert.deepEqual(state.errors, []);
});
test("published package link and search preview use the API public site address", async t => {
  const { page, state } = await setup(t, false, { status: "PUBLISHED" });
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  const publicUrl = `${base}/packages/${fixture.slug}`;
  assert.equal(await page.getByRole("link", { name: "View public page" }).getAttribute("href"), publicUrl);
  await page.getByText(publicUrl, { exact: true }).waitFor();
  assert.deepEqual(state.errors, []);
});
test("category radios use master options, replace the selection and retain it after saving", async t => {
  const { page, state } = await setup(t, false, { categories: [categoryMaster[0]] });
  const categories = page.getByRole("group", { name: "Categories", exact: true });
  assert.equal(await page.getByRole("textbox", { name: "Search categories", exact: true }).count(), 0);
  const adventure = categories.getByRole("radio", { name: "Adventure published", exact: true });
  const cultural = categories.getByRole("radio", { name: "Cultural tours published", exact: true });
  assert.equal(await adventure.isChecked(), true);
  assert.equal(await categories.getByRole("radio", { name: "Retired category archived", exact: true }).isDisabled(), true);
  await cultural.check();
  assert.equal(await adventure.isChecked(), false);
  assert.equal(await categories.locator('input[type="radio"]:checked').count(), 1);
  await cultural.press("ArrowLeft");
  assert.equal(await adventure.isChecked(), true);
  await cultural.check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.deepEqual(state.record.categories.map(item => item.id), ["cultural"]);
  await page.reload();
  await cultural.waitFor();
  assert.equal(await cultural.isChecked(), true);
  assert.deepEqual(state.errors, []);
});
test("legacy multiple categories require an explicit choice before saving", async t => {
  const { page, state } = await setup(t, false, { categories: categoryMaster.slice(0, 2) });
  await page.getByText("This package has multiple categories. Select one category before saving.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Select only one category.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByRole("radio", { name: "Adventure published", exact: true }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.deepEqual(state.record.categories.map(item => item.id), ["adventure"]);
  assert.deepEqual(state.errors, []);
});
test("content saves full overview and detail notes without a separate summary", async t => {
  const { page, state } = await setup(t);
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Summary", exact: true }).count(), 0);
  const overview = "Explore the mountains with a local guide.\n\n" + "Enjoy relaxed walks and comfortable stays. ".repeat(20);
  await page.getByRole("textbox", { name: "Overview", exact: true }).fill(overview);
  await page.getByText("Transport and accommodation", { exact: true }).click();
  await page.getByRole("textbox", { name: "Transport and pickup information", exact: true }).fill("Pickup from Delhi.\nDeparture at 6 AM.");
  await page.getByRole("textbox", { name: "Accommodation notes", exact: true }).fill("Hotel stays included.\nRooms confirmed before travel.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  const write = state.writes.findLast(item => item.path === "/admin/packages/test-package");
  assert.equal(write.body.overview, overview);
  assert.ok(write.body.summary.startsWith("Explore the mountains with a local guide. Enjoy relaxed walks"));
  assert.ok(write.body.summary.length <= 500);
  assert.ok(write.body.summary.endsWith("..."));
  assert.equal(write.body.transportInformation, "Pickup from Delhi.\nDeparture at 6 AM.");
  assert.equal(write.body.accommodationNotes, "Hotel stays included.\nRooms confirmed before travel.");
  await page.reload();
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Overview", exact: true }).inputValue(), overview);
  assert.deepEqual(state.errors, []);
});
test("gallery upload, cover, confirmed removal and brochure single selection persist", async t => {
  const { page, state } = await setup(t, false, { summary: "" });
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await gallery.locator("article").count(), 1);
  const chooserReady = page.waitForEvent("filechooser");
  await gallery.getByRole("button", { name: "Choose photos", exact: true }).click();
  const chooser = await chooserReady;
  await chooser.setFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await gallery.getByText("uploaded-3.webp", { exact: true }).waitFor();
  await gallery.getByRole("button", { name: "Set as cover", exact: true }).click();
  await gallery.locator("article").first().getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove file", exact: true }).click();
  assert.equal(await gallery.locator("article").count(), 1);
  assert.equal(state.writes.some(write => write.method === "DELETE"), false);
  await page.getByRole("tab", { name: "Policies", exact: true }).click();
  const brochure = page.getByRole("region", { name: "Downloadable brochure", exact: true });
  await brochure.getByRole("button", { name: "Select from library" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "brochure.pdf PUBLIC" }).click();
  assert.equal(await brochure.locator('input[type="file"]').count(), 0);
  await page.getByRole("tab", { name: "Itinerary", exact: true }).click();
  const photo = page.getByRole("region", { name: "Day 1 photo", exact: true });
  await photo.getByRole("button", { name: "Select from library" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "extra.webp PUBLIC" }).click();
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  await page.getByRole("button", { name: "Publish package", exact: true }).click();
  await page.getByText("Package published.", { exact: true }).waitFor();
  const write = state.writes.findLast(item => item.path === "/admin/packages/test-package");
  assert.equal(write.body.media[0].mediaAssetId, "uploaded-3"); assert.equal(write.body.media[0].isCover, true); assert.equal(write.body.brochureMediaId, "brochure"); assert.equal(write.body.itinerary[0].imageMediaId, "extra"); assert.equal(write.body.status, "PUBLISHED");
  assert.equal(write.body.summary, fixture.overview);
  assert(state.writes.every(item => item.csrf === "test-csrf")); assert.deepEqual(state.errors, []);
});
test("file metadata, retry after failed upload, date calculation and mobile layout", async t => {
  const { page, state } = await setup(t);
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Alternative text", { exact: true }).fill("A mountain sunrise");
  await page.getByRole("button", { name: "Save file details", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(state.assets.get("cover").altText, "A mountain sunrise");
  state.failUpload = true;
  await gallery.locator('input[type="file"]').setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await page.getByText("Upload failed. Retry.", { exact: true }).waitFor();
  assert.equal(await gallery.locator("article").count(), 1);
  state.failUpload = false;
  await gallery.locator('input[type="file"]').setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await gallery.getByText("uploaded-3.webp", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Departures", exact: true }).click();
  await page.getByRole("button", { name: "Fixed departures", exact: true }).click(); await page.getByRole("button", { name: "Add departure", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2027-04-01"); assert.equal(await page.getByLabel("End date", { exact: true }).inputValue(), "2027-04-02");
  await page.getByLabel("Status", { exact: true }).click(); await page.getByRole("option", { name: "Filling fast", exact: true }).click(); await page.getByLabel("Seats available (optional)").fill("4");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Save changes", exact: true }).click(); await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.equal(state.record.departures[0].seatsAvailable, 4); assert.equal(state.record.departures[0].status, "FILLING_FAST"); assert.deepEqual(state.errors, []);
});

test("live preview follows typing and rejects an oversized upload without a request", async t => {
  const { page, state } = await setup(t);
  await page.getByRole("button", { name: "Preview live card", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Live mountain preview");
  const preview = page.getByRole("complementary", { name: "Live package preview" });
  assert.equal(await preview.getByRole("heading", { name: "Live mountain preview" }).count(), 2);
  await page.screenshot({ path: join(tmpdir(), "br-package-editor-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.locator('input[type="file"]').setInputFiles({ name: "oversized.png", mimeType: "image/png", buffer: Buffer.alloc(4_000_001) });
  await page.getByText("Choose JPEG, PNG, WebP or AVIF images under 4 MB each.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(state.errors, []);
});

test("replacement errors are visible; retry preserves metadata, gallery order and the non-first cover", async t => {
  const { page, state } = await setup(t, false, { media: [{ ...media("extra"), isCover: false, sortOrder: 0 }, { ...media("cover"), isCover: true, sortOrder: 1 }] });
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.locator("article").nth(1).getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit file", exact: true });
  await editor.getByLabel("Alternative text", { exact: true }).fill("Replacement mountain view");
  await editor.getByLabel("Caption", { exact: true }).fill("A new sunrise");
  await editor.getByLabel("Visibility", { exact: true }).click(); await page.getByRole("option", { name: "Private", exact: true }).click();
  state.failUpload = true;
  await editor.locator('input[type="file"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await editor.getByRole("alert").getByText("Upload failed. Retry.", { exact: true }).waitFor();
  assert.equal(await gallery.locator("article").count(), 2);
  assert.equal(await gallery.getByText("cover.webp", { exact: true }).count(), 1);
  state.failUpload = false;
  let release;
  state.uploadGate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const chooserReady = page.waitForEvent("filechooser");
  await editor.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (await chooserReady).setFiles({ name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await editor.getByRole("status").filter({ hasText: "Uploading 1 of 1" }).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Choose photo", exact: true }).isDisabled(), true);
  assert.equal(await editor.getByLabel("Alternative text", { exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await editor.isVisible(), true);
  release();
  await editor.waitFor({ state: "hidden" });
  await gallery.getByText("uploaded-3.webp", { exact: true }).waitFor();
  assert.equal(await gallery.locator("article").nth(1).getByRole("button", { name: "Cover image", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(state.assets.get("uploaded-3").altText, "Replacement mountain view");
  assert.equal(state.assets.get("uploaded-3").caption, "A new sunrise");
  assert.equal(state.assets.get("uploaded-3").visibility, "PRIVATE");
  assert.equal(state.assets.get("cover").altText, "Travel cover");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.deepEqual(state.record.media.map(({ mediaAssetId, isCover, sortOrder }) => ({ mediaAssetId, isCover, sortOrder })), [{ mediaAssetId: "extra", isCover: false, sortOrder: 0 }, { mediaAssetId: "uploaded-3", isCover: true, sortOrder: 1 }]);
  await page.reload();
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  await gallery.getByText("uploaded-3.webp", { exact: true }).waitFor();
  assert.equal(await gallery.getByText("cover.webp", { exact: true }).count(), 0);
  assert(state.writes.every(item => item.csrf === "test-csrf"));
  assert.deepEqual(state.errors, []);
});

test("library replacement works in a full gallery and single-photo field; cancelling keeps the editor", async t => {
  const initial = Array.from({ length: 10 }, (_, index) => ({ ...media(`photo-${index}`), isCover: index === 4, sortOrder: index }));
  const { page, state } = await setup(t, false, { media: initial, itinerary: fixture.itinerary.map(day => ({ ...day, imageMediaId: "cover" })) });
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.locator("article").nth(4).getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit file", exact: true });
  const library = page.getByRole("dialog", { name: "Select images from library", exact: true });
  await editor.getByRole("button", { name: "Select from library", exact: true }).click();
  assert.equal(await library.getByRole("button", { name: "photo-0.webp PUBLIC" }).isDisabled(), true);
  await page.keyboard.press("Escape");
  await library.waitFor({ state: "hidden" });
  assert.equal(await editor.isVisible(), true);
  assert.equal(await editor.getByRole("button", { name: "Select from library", exact: true }).evaluate(element => document.activeElement === element), true);
  await editor.screenshot({ path: join(tmpdir(), "br-file-replacement-desktop.png") });
  await editor.getByRole("button", { name: "Select from library", exact: true }).click();
  await library.getByRole("button", { name: "extra.webp PUBLIC" }).click();
  await editor.waitFor({ state: "hidden" });
  assert.equal(await gallery.locator("article").count(), 10);
  assert.equal(await gallery.locator("article").nth(4).getByText("extra.webp", { exact: true }).count(), 1);
  assert.equal(await gallery.locator("article").nth(4).getByRole("button", { name: "Cover image", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("tab", { name: "Itinerary", exact: true }).click();
  const day = page.getByRole("region", { name: "Day 1 photo", exact: true });
  await day.getByRole("button", { name: "Edit", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await editor.screenshot({ path: join(tmpdir(), "br-file-replacement-mobile.png") });
  await editor.getByRole("button", { name: "Select from library", exact: true }).click();
  await library.getByRole("button", { name: "extra.webp PUBLIC" }).click();
  await editor.waitFor({ state: "hidden" });
  await day.getByText("extra.webp", { exact: true }).waitFor();
  assert.equal(await day.locator("article").count(), 1);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.equal(state.record.media[4].mediaAssetId, "extra");
  assert.equal(state.record.media[4].isCover, true);
  assert.equal(state.record.itinerary[0].imageMediaId, "extra");
  assert.equal(state.record.itinerary[1].imageMediaId, "cover");
  assert.equal(state.writes.filter(write => write.path.startsWith("/admin/media")).length, 0);
  assert.deepEqual(state.errors, []);
});

test("single PDF replacement validates file type and supports dropping a new brochure", async t => {
  const { page, state } = await setup(t, false, { brochure: media("brochure", "application/pdf") });
  await page.getByRole("tab", { name: "Policies", exact: true }).click();
  const brochure = page.getByRole("region", { name: "Downloadable brochure", exact: true });
  await brochure.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit file", exact: true });
  assert.equal(await editor.locator('input[type="file"]').getAttribute("accept"), "application/pdf");
  await editor.locator('input[type="file"]').setInputFiles({ name: "wrong.png", mimeType: "image/png", buffer: Buffer.from("test-only") });
  await editor.getByRole("alert").getByText("Choose PDF files under 4 MB each.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  const files = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(["%PDF-1.4 test"], "replacement.pdf", { type: "application/pdf" })); return data; });
  await editor.getByRole("region", { name: "Upload new PDF", exact: true }).dispatchEvent("drop", { dataTransfer: files });
  await files.dispose();
  await editor.waitFor({ state: "hidden" });
  await brochure.getByText("uploaded-3.pdf", { exact: true }).waitFor();
  assert.equal(await brochure.locator("article").count(), 1);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Package saved.", { exact: true }).waitFor();
  assert.equal(state.record.brochureMediaId, "uploaded-3");
  assert.equal(state.writes.some(write => write.method === "DELETE"), false);
  assert.deepEqual(state.errors, []);
});

test("public cover remains ready after a long editing session without visiting Media", async t => {
  const { page, state } = await setup(t);
  await page.clock.install();
  await page.reload();
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  const coverCheck = page.getByRole("button", { name: "Public cover image selected", exact: true });
  assert.match(await coverCheck.getAttribute("class"), /text-admin-positive/);
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page.clock.fastForward(6 * 60_000);
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  assert.match(await coverCheck.getAttribute("class"), /text-admin-positive/);
  await page.getByRole("button", { name: "Publish package", exact: true }).click();
  await page.getByText("Package published.", { exact: true }).waitFor();
  assert.equal(state.record.status, "PUBLISHED");
  assert.deepEqual(state.errors, []);
});

test("cover readiness follows visibility edits and removal", async t => {
  const { page, state } = await setup(t, false, { media: [{ ...media("cover"), visibility: "PRIVATE", isCover: true, sortOrder: 0 }] });
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  const check = page.getByRole("button", { name: "Public cover image selected", exact: true });
  assert.match(await check.getAttribute("class"), /text-admin-negative/);
  await page.getByText("The selected cover is private. Open Media, edit the cover and set Visibility to Public.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Publish package", exact: true }).click();
  await page.getByText("Complete the publishing checklist first.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await check.click();
  const gallery = page.getByRole("region", { name: "Package gallery", exact: true });
  await gallery.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit file", exact: true });
  await editor.getByLabel("Visibility", { exact: true }).click(); await page.getByRole("option", { name: "Public", exact: true }).click();
  await editor.getByRole("button", { name: "Save file details", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  assert.match(await check.getAttribute("class"), /text-admin-positive/);
  await check.click();
  await gallery.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove file", exact: true }).click();
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  assert.match(await check.getAttribute("class"), /text-admin-negative/);
  assert.deepEqual(state.errors, []);
});

test("missing cover details load on Publishing and a failed lookup can be retried", async t => {
  const { page, state } = await setup(t);
  state.record.media = [{ id: "cover", isCover: true, sortOrder: 0 }];
  let release;
  let failLookup = true;
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  await page.route("**/api/v1/admin/media/cover", async route => {
    if (!failLookup) return route.fallback();
    await gate;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "TEMPORARY_FAILURE", message: "Cover lookup failed. Retry." } }) });
  });
  await page.reload();
  await page.getByRole("tab", { name: "Publishing", exact: true }).click();
  await page.getByRole("status").getByText("Checking cover image…", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Publish package", exact: true }).click();
  await page.getByText("Complete the publishing checklist first.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  release();
  await page.getByRole("alert").getByText("Cover lookup failed. Retry.", { exact: true }).waitFor();
  await page.getByRole("radio", { name: "DRAFT", exact: true }).check();
  failLookup = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const check = page.getByRole("button", { name: "Public cover image selected", exact: true });
  await check.and(page.locator(".text-admin-positive")).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByRole("button", { name: "Publish package", exact: true }).click();
  await page.getByText("Package published.", { exact: true }).waitFor();
  assert.equal(state.record.status, "PUBLISHED");
  assert.deepEqual(state.errors, []);
});
