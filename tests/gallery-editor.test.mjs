import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.GALLERY_TEST_BASE_URL || "http://127.0.0.1:5197";
let vite, browser;
before(async () => {
  if (!process.env.GALLERY_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_PUBLIC_SITE_URL: base, VITE_API_PROXY_TARGET: "" } });
    for (let i = 0; i < 120; i++) {
      if (vite.exitCode !== null) throw new Error("Gallery test server could not start.");
      if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break;
      await delay(250);
    }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const photo = (id, visibility = "PUBLIC") => ({ id, visibility, mimeType: "image/webp", originalName: `${id}.webp`, altText: `Travel ${id}`, caption: null, url: `/media/${id}`, width: 1200, height: 800, sizeBytes: "224000", sourceNotes: null, licenseNotes: null, provider: "LOCAL", createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" });
const destination = { id: "rajasthan", name: "Rajasthan", slug: "rajasthan", status: "PUBLISHED" };
const fixture = { id: "rajasthan-trip", title: "Rajasthan moments", slug: "rajasthan-moments", description: "A journey through forts and desert landscapes.", destinationId: destination.id, destination, status: "PUBLISHED", publishedAt: "2026-09-20T11:20:37.000Z", updatedAt: "2026-09-21T00:00:00Z", isDemo: false, images: [photo("cover"), photo("legacy-150")].map((mediaAsset, sortOrder) => ({ mediaAssetId: mediaAsset.id, mediaAsset, sortOrder })) };
async function setup(t, path = "gallery", options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" });
  t.after(() => context.close());
  const state = { albums: structuredClone([fixture, { ...fixture, id: "draft", title: "Coastal memories", slug: "coastal-memories", status: "DRAFT", images: [], publishedAt: null }, { ...fixture, id: "archived", title: "Old album", slug: "old-album", status: "ARCHIVED", images: [] }]), assets: [photo("cover"), photo("private", "PRIVATE"), ...Array.from({ length: 23 }, (_, i) => photo(`library-${i}`)), photo("legacy-150")], writes: [], errors: [], reads: [], failSave: false, failList: false, failUpload: false, uploadGate: null, ...options };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", authenticated: true, user: { id: "test-admin", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (request.method() === "GET") state.reads.push(path);
    else state.writes.push({ path, method: request.method(), csrf: request.headers()["x-csrf-token"], body: request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null });
    if (/^\/admin\/media\/[^/]+\/file$/.test(path)) return route.fulfill({ contentType: "image/png", body: png });
    if (path === "/admin/destinations") return json({ data: state.destinations ?? [destination] });
    if (path === "/admin/media" && request.method() === "POST") {
      if (state.uploadGate) await state.uploadGate;
      if (state.failUpload) return json({ error: { code: "UPLOAD_FAILED", message: "Upload failed. Retry." } }, 500);
      const fields = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
      const asset = { ...photo("uploaded"), altText: fields.get("altText"), originalName: fields.get("file").name, visibility: fields.get("visibility") };
      state.assets.push(asset); return json({ data: asset }, 201);
    }
    if (path === "/admin/media") {
      const q = url.searchParams.get("q")?.toLowerCase() ?? "", page = Number(url.searchParams.get("page") || 1), pageSize = Number(url.searchParams.get("pageSize") || 24);
      const assets = state.assets.filter(asset => `${asset.altText} ${asset.originalName}`.toLowerCase().includes(q));
      return json({ data: assets.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: assets.length } });
    }
    if (path.startsWith("/admin/media/")) {
      const asset = state.assets.find(item => item.id === path.split("/").at(-1));
      if (request.method() === "PATCH") Object.assign(asset, request.postDataJSON());
      return json({ data: asset });
    }
    if (path === "/admin/gallery/albums" && request.method() === "GET") {
      if (state.failList) return json({ error: { code: "FAILED", message: "Albums could not load. Please retry." } }, 500);
      return json({ data: state.albums });
    }
    if (path.startsWith("/admin/gallery/albums")) {
      const id = path.split("/")[4];
      if (request.method() === "DELETE") {
        if (path.endsWith("/permanent")) state.albums = state.albums.filter(item => item.id !== id);
        else state.albums.find(item => item.id === id).status = "ARCHIVED";
        return route.fulfill({ status: 204 });
      }
      const values = request.postDataJSON();
      if (state.failSave) return json({ error: { code: "SAVE_FAILED", message: "Album could not save. Please retry." } }, 500);
      assert.match(values.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/); assert(values.slug.length <= 180);
      const record = { ...values, id: id || "created-album", destination: values.destinationId ? destination : null, images: values.mediaIds.map((mediaAssetId, sortOrder) => ({ mediaAssetId, sortOrder, mediaAsset: structuredClone(state.assets.find(item => item.id === mediaAssetId)) })) };
      if (id) state.albums[state.albums.findIndex(item => item.id === id)] = record;
      else state.albums.unshift(record);
      return json({ data: record }, id ? 200 : 201);
    }
    assert.equal(request.method(), "GET", `Unexpected write: ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return { page, state };
}
const albumPhotos = page => page.getByRole("region", { name: "Album photos", exact: true });
const photoCard = (page, name) => albumPhotos(page).getByRole("article").filter({ hasText: `${name}.webp` });

test("shared dropdowns support keyboard selection, empty values and menus within laptop and mobile screens", async t => {
  const destinations = [destination, ...Array.from({ length: 40 }, (_, index) => ({ ...destination, id: `place-${index}`, name: `Destination ${String(index + 1).padStart(2, "0")}` }))];
  const { page, state } = await setup(t, "gallery/new", { destinations });
  const destinationField = page.getByRole("combobox", { name: "Destination", exact: true });
  await destinationField.waitFor();
  await page.setViewportSize({ width: 1366, height: 657 });
  await destinationField.focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("listbox").waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "option");
  await page.keyboard.press("End");
  await page.waitForFunction(() => document.activeElement?.textContent === "Destination 40");
  await page.keyboard.press("Enter");
  assert.equal(await destinationField.innerText(), "Destination 40");
  await destinationField.click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "option");
  await page.keyboard.type("Rajasthan");
  await page.waitForFunction(() => document.activeElement?.textContent === "Rajasthan");
  await page.keyboard.press("Enter");
  assert.equal(await destinationField.innerText(), "Rajasthan");
  for (const viewport of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await destinationField.click();
    const menu = page.getByRole("listbox");
    await menu.waitFor();
    const box = await menu.boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, "Menu remains inside the viewport");
    assert(box.height <= 320, "Long lists use a compact scrollable menu");
    await page.screenshot({ path: join(tmpdir(), `br-admin-dropdown-${viewport.width}.png`) });
    await page.keyboard.press("Escape");
    assert(await destinationField.evaluate(element => element === document.activeElement));
  }
  await destinationField.click();
  await page.getByRole("option", { name: "No destination", exact: true }).click();
  await page.getByLabel("Album title", { exact: true }).fill("Dropdown selection check");
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.waitForURL(`${base}/admin/gallery`);
  assert.equal(state.writes.at(-1).body.destinationId, null);
  assert.equal(state.writes.at(-1).body.status, "DRAFT");
  assert.deepEqual(state.errors, []);
});

test("gallery list searches all albums, filters statuses and confirms archive and permanent delete", async t => {
  const { page, state } = await setup(t);
  await page.getByText("3 albums in your gallery", { exact: true }).waitFor();
  assert.equal(await page.getByRole("article").count(), 3);
  await page.getByRole("textbox", { name: "Search albums", exact: true }).fill("desert");
  // All three fixtures share the description; title search narrows it to one.
  await page.getByRole("textbox", { name: "Search albums", exact: true }).fill("Coastal");
  await page.getByText("1 album found", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Published/ }).click();
  await page.getByText("No matching albums", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  const card = page.getByRole("article").filter({ hasText: "Rajasthan moments" });
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(state.writes.length, 0);
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Archive album", exact: true }).click();
  await card.getByText("ARCHIVED", { exact: true }).waitFor();
  assert.equal(state.writes[0].path, "/admin/gallery/albums/rajasthan-trip");
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete gallery album", exact: true }).click();
  await page.getByText("2 albums in your gallery", { exact: true }).waitFor();
  assert.equal(state.writes[1].path, "/admin/gallery/albums/rajasthan-trip/permanent");
  assert.equal(state.assets.length, 26);
  assert(state.writes.every(item => item.csrf === "test-csrf"));
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(state.errors, []);
});

test("new album validates its title, creates its URL automatically and preserves input after a failed save", async t => {
  const { page, state } = await setup(t, "gallery/new");
  await page.getByLabel("Album title", { exact: true }).waitFor();
  assert.equal(state.reads.includes("/admin/gallery/albums"), false);
  assert.equal(state.reads.includes("/admin/media"), false);
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.getByText("Enter an album title of at least 2 characters.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByLabel("Album title", { exact: true }).fill("  ગુજરાત પ્રવાસ  ");
  await page.getByLabel("Description", { exact: true }).fill("Photos from our journey.");
  await page.getByLabel("Destination", { exact: true }).click(); await page.getByRole("option", { name: "Rajasthan", exact: true }).click();
  state.failSave = true;
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.getByText("Album could not save. Please retry.", { exact: true }).last().waitFor();
  assert.equal(await page.getByLabel("Description", { exact: true }).inputValue(), "Photos from our journey.");
  state.failSave = false;
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.waitForURL(`${base}/admin/gallery`);
  const [first, second] = state.writes;
  assert.equal(first.body.slug, second.body.slug);
  assert.match(second.body.slug, /^album-[a-f0-9]{16}$/);
  assert.equal(second.body.title, "ગુજરાત પ્રવાસ");
  assert.equal(second.body.status, "DRAFT");
  assert.equal(second.body.isDemo, false);
  assert.deepEqual(second.body.mediaIds, []);
  assert.deepEqual(state.errors, []);
});

test("album uploads, library search, cover ordering and confirmed removal save the intended photos", async t => {
  const { page, state } = await setup(t, "gallery/new");
  await page.getByLabel("Album title", { exact: true }).fill("Mountain memories");
  await page.getByRole("button", { name: "Select from library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Select images from library" });
  await library.getByRole("button", { name: "Next files", exact: true }).click();
  await library.getByRole("button", { name: /legacy-150.webp/ }).click();
  await library.getByRole("button", { name: "Close Select images from library" }).click();
  await photoCard(page, "legacy-150").waitFor();
  let release; state.uploadGate = new Promise(resolve => { release = resolve; });
  await albumPhotos(page).getByLabel("Upload photos from your device").setInputFiles({ name: "mountain-lake.png", mimeType: "image/png", buffer: png });
  await page.getByText("Uploading photos. Please wait before saving.", { exact: true }).waitFor();
  assert(await page.getByRole("button", { name: "Save album", exact: true }).isDisabled());
  release();
  const uploaded = albumPhotos(page).getByRole("article").filter({ hasText: "mountain-lake.png" });
  await uploaded.getByRole("button", { name: "Set as cover", exact: true }).click();
  assert.match(await albumPhotos(page).getByRole("article").first().innerText(), /mountain-lake.png/);
  await page.getByRole("region", { name: "Album cover preview" }).getByAltText("mountain lake").waitFor();
  await photoCard(page, "legacy-150").getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await albumPhotos(page).getByRole("article").count(), 2);
  await photoCard(page, "legacy-150").getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Remove file", exact: true }).click();
  await page.getByRole("button", { name: "Select from library", exact: true }).click();
  await library.getByLabel("Search media").fill("cover");
  await library.getByRole("button", { name: /cover.webp/ }).click();
  await library.getByRole("button", { name: "Close Select images from library" }).click();
  await page.getByLabel("Status", { exact: true }).click(); await page.getByRole("option", { name: "Published", exact: true }).click();
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.waitForURL(`${base}/admin/gallery`);
  const saved = state.writes.find(write => write.path === "/admin/gallery/albums");
  assert.deepEqual(saved.body.mediaIds, ["uploaded", "cover"]);
  assert.equal(saved.body.status, "PUBLISHED");
  assert.equal(state.assets.some(asset => asset.id === "legacy-150"), true);
  assert.deepEqual(state.errors, []);
});

test("publishing requires a public photo and scheduling uses the admin timezone", async t => {
  const { page, state } = await setup(t, "gallery/new");
  await page.getByLabel("Album title", { exact: true }).fill("New destination");
  await page.getByLabel("Status", { exact: true }).click(); await page.getByRole("option", { name: "Published", exact: true }).click();
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.getByText(/Add at least one public photo before publishing/).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByRole("button", { name: "Select from library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Select images from library" });
  await library.getByRole("button", { name: /private.webp/ }).click();
  await library.getByRole("button", { name: "Close Select images from library" }).click();
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.getByText(/Add at least one public photo before publishing/).waitFor();
  assert.equal(state.writes.length, 0);
  await photoCard(page, "private").getByRole("button", { name: "Edit", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Edit file", exact: true });
  await details.getByLabel("Visibility", { exact: true }).click();
  await details.getByRole("listbox").waitFor();
  await page.keyboard.press("Escape");
  assert(await details.isVisible(), "Escape closes the menu without dismissing the file editor");
  assert(await details.getByLabel("Visibility", { exact: true }).evaluate(element => element === document.activeElement));
  await details.getByLabel("Visibility", { exact: true }).click(); await page.getByRole("option", { name: "Public", exact: true }).click();
  await details.getByRole("button", { name: "Save file details", exact: true }).click();
  await details.waitFor({ state: "hidden" });
  await page.getByLabel("Publish date & time", { exact: true }).fill("2027-01-10T10:00");
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.waitForURL(`${base}/admin/gallery`);
  const saved = state.writes.at(-1);
  assert.equal(saved.body.publishedAt, "2027-01-10T04:30:00.000Z");
  assert.deepEqual(saved.body.mediaIds, ["private"]);
  assert.deepEqual(state.errors, []);
});

test("editing preserves existing URLs and exact publish times, reorders older photos and protects unsaved changes", async t => {
  const { page, state } = await setup(t, "gallery/rajasthan-trip/edit");
  await photoCard(page, "legacy-150").waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Destination", exact: true }).innerText(), "Rajasthan");
  assert.equal(await page.getByRole("combobox", { name: "Status", exact: true }).innerText(), "Published");
  assert.equal(await page.getByLabel("Publish date & time", { exact: true }).inputValue(), "2026-09-20T16:50");
  await page.getByLabel("Album title", { exact: true }).fill("Renamed Rajasthan album");
  await photoCard(page, "legacy-150").getByRole("button", { name: "Move legacy-150.webp up", exact: true }).click();
  await page.getByRole("link", { name: "Back to albums", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Discard unsaved changes?" }).getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(tmpdir(), "br-gallery-edit-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Save album", exact: true }).click();
  await page.waitForURL(`${base}/admin/gallery`);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].body.slug, fixture.slug);
  assert.equal(state.writes[0].body.publishedAt, fixture.publishedAt);
  assert.deepEqual(state.writes[0].body.mediaIds, ["legacy-150", "cover"]);
  assert.deepEqual(state.errors, []);
});

test("missing albums and failed list requests have a usable recovery path", async t => {
  const missing = await setup(t, "gallery/missing/edit");
  await missing.page.getByText("Album not found", { exact: true }).waitFor();
  await missing.page.getByRole("link", { name: "Back to albums", exact: true }).click();
  await missing.page.getByText("3 albums in your gallery", { exact: true }).waitFor();
  const failed = await setup(t, "gallery", { failList: true });
  await failed.page.getByText("Albums could not load. Please retry.", { exact: true }).waitFor();
  failed.state.failList = false;
  await failed.page.getByRole("button", { name: "Retry", exact: true }).click();
  await failed.page.getByText("3 albums in your gallery", { exact: true }).waitFor();
  assert.deepEqual(missing.state.errors, []);
  assert.deepEqual(failed.state.errors, []);
});
