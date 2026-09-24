import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.MEDIA_TEST_BASE_URL || "http://127.0.0.1:5196";
let vite, browser;
before(async () => {
  if (!process.env.MEDIA_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_PUBLIC_SITE_URL: base, VITE_API_PROXY_TARGET: "" } });
    for (let i = 0; i < 120; i++) {
      if (vite.exitCode !== null) throw new Error("Media test server could not start.");
      if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break;
      await delay(250);
    }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const media = (index) => ({ id: `asset-${index}`, mimeType: index === 26 ? "application/pdf" : "image/webp", originalName: index === 26 ? "nepal-brochure.pdf" : `landscape-${index}.webp`, altText: index === 26 ? "Nepal tour brochure" : `Landscape ${index}`, url: `/media/${index}`, caption: null, width: 1200, height: 800, sizeBytes: "224000", visibility: index === 26 ? "PRIVATE" : "PUBLIC", sourceNotes: "BR team", licenseNotes: "Owned", provider: "LOCAL", createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" });
async function setup(t, path = "media") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  t.after(() => context.close());
  const state = { assets: Array.from({ length: 26 }, (_, i) => media(i + 1)), lists: [], writes: [], errors: [], failUpload: false, failList: false, uploadGate: null, inUse: false };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", authenticated: true, user: { id: "test-admin", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (/^\/admin\/media\/[^/]+\/file$/.test(path)) return route.fulfill({ contentType: "image/png", body: png });
    if (request.method() !== "GET") state.writes.push({ path, method: request.method(), csrf: request.headers()["x-csrf-token"] });
    if (path === "/admin/media" && request.method() === "POST") {
      if (state.uploadGate) await state.uploadGate;
      if (state.failUpload) return json({ error: { code: "UPLOAD_FAILED", message: "Could not upload. Please try again." } }, 500);
      const fields = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
      const file = fields.get("file"), values = Object.fromEntries([...fields].filter(([key]) => key !== "file"));
      state.writes.at(-1).fields = values;
      const asset = { ...media(100), ...values, id: "uploaded", originalName: file.name, mimeType: file.type };
      state.assets.unshift(asset); return json({ data: asset }, 201);
    }
    if (path === "/admin/media") {
      const params = Object.fromEntries(url.searchParams); state.lists.push(params);
      if (state.failList) return json({ error: { code: "FAILED", message: "Library could not load." } }, 500);
      const { kind, visibility, q = "" } = params, page = Number(params.page || 1), pageSize = Number(params.pageSize || 25);
      const assets = state.assets.filter(asset => (!kind || (kind === "pdf" ? asset.mimeType === "application/pdf" : asset.mimeType.startsWith("image/"))) && (!visibility || asset.visibility === visibility) && `${asset.altText} ${asset.originalName}`.toLowerCase().includes(q.toLowerCase()));
      return json({ data: assets.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: assets.length } });
    }
    if (path.startsWith("/admin/media/")) {
      const id = path.split("/").at(-1), asset = state.assets.find(item => item.id === id);
      if (request.method() === "PATCH") { state.writes.at(-1).body = request.postDataJSON(); Object.assign(asset, request.postDataJSON()); }
      if (request.method() === "DELETE") {
        if (state.inUse) return json({ error: { code: "MEDIA_IN_USE", message: "This file is still used by a package." } }, 409);
        state.assets = state.assets.filter(item => item.id !== id); return route.fulfill({ status: 204 });
      }
      return json({ data: asset });
    }
    assert.equal(request.method(), "GET", `Unexpected write ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { level: 1 }).waitFor();
  return { page, state };
}

test("library searches beyond the current page, combines filters, previews files and resets pagination", async t => {
  const { page, state } = await setup(t);
  await page.getByText("26 files in your library", { exact: true }).waitFor();
  assert.equal(await page.getByRole("article").count(), 25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Preview nepal-brochure.pdf", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search library" }).fill("landscape-1.webp");
  await page.getByText(/^1 file found/).waitFor();
  assert.equal(state.lists.at(-1).page, "1");
  assert.equal(state.lists.at(-1).q, "landscape-1.webp");
  await page.getByRole("button", { name: "Preview landscape-1.webp", exact: true }).click();
  await page.getByRole("dialog", { name: "File preview" }).waitFor();
  await page.getByRole("button", { name: "Close File preview" }).click();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "PDF brochures", exact: true }).click();
  await page.getByRole("combobox", { name: "Visibility", exact: true }).click(); await page.getByRole("option", { name: "Private", exact: true }).click();
  await page.getByRole("button", { name: "Preview nepal-brochure.pdf", exact: true }).waitFor();
  assert.equal(state.lists.at(-1).kind, "pdf");
  assert.equal(state.lists.at(-1).visibility, "PRIVATE");
  await page.getByRole("combobox", { name: "Visibility", exact: true }).click(); await page.getByRole("option", { name: "Public", exact: true }).click();
  await page.getByText("No matching files", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await page.getByText("26 files in your library", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(state.errors, []);
});

test("upload validates locally, previews a photo and retries failed uploads with preserved metadata", async t => {
  const { page, state } = await setup(t, "media/new");
  const input = page.getByLabel("Upload file from your device");
  assert.equal(state.lists.length, 0, "Upload page should not load the full library");
  await input.setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg />") });
  await page.getByText("Choose a JPG, PNG, WebP, AVIF image or a PDF brochure.", { exact: true }).waitFor();
  await input.setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(4_000_001) });
  await page.getByText("Choose a non-empty file up to 4 MB.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await input.setInputFiles({ name: "mountain-lake.png", mimeType: "image/png", buffer: png });
  await page.getByAltText("Preview of mountain-lake.png").waitFor();
  assert.equal(await page.getByLabel("Alt text", { exact: true }).inputValue(), "mountain lake");
  await page.getByLabel("Alt text", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Upload to library", exact: true }).click();
  await page.getByText("Add a description of at least 2 characters.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByLabel("Alt text", { exact: true }).fill("Mountain lake in Sikkim");
  await page.getByLabel("Caption", { exact: true }).fill("A peaceful afternoon");
  await page.getByRole("radio", { name: /^Public/ }).check();
  state.failUpload = true;
  await page.getByRole("button", { name: "Upload to library", exact: true }).click();
  await page.getByText("Could not upload. Please try again.", { exact: true }).last().waitFor();
  assert.equal(await page.getByLabel("Caption", { exact: true }).inputValue(), "A peaceful afternoon");
  state.failUpload = false;
  let release; state.uploadGate = new Promise(resolve => { release = resolve; });
  await page.getByRole("button", { name: "Upload to library", exact: true }).click();
  await page.getByRole("button", { name: "Uploading…", exact: true }).waitFor();
  assert(await page.getByLabel("Alt text", { exact: true }).isDisabled());
  assert(await input.isDisabled());
  release();
  await page.waitForURL(`${base}/admin/media`);
  assert.equal(state.writes.length, 2);
  assert.equal(state.writes.at(-1).csrf, "test-csrf");
  assert.deepEqual(state.writes.at(-1).fields, { altText: "Mountain lake in Sikkim", caption: "A peaceful afternoon", visibility: "PUBLIC" });
  await page.getByRole("heading", { name: "Mountain lake in Sikkim", exact: true }).waitFor();
  assert.deepEqual(state.errors, []);
});

test("PDF drag and drop, mobile layout and unsaved changes protection", async t => {
  const { page, state } = await setup(t, "media/new");
  await page.getByRole("region", { name: "Upload new file", exact: true }).evaluate(element => {
    const transfer = new DataTransfer(); transfer.items.add(new File(["%PDF-1.7 test"], "nepal-brochure.pdf", { type: "application/pdf" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  });
  await page.getByText("PDF brochure selected", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(tmpdir(), "br-media-upload-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Back to library", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Discard unsaved changes?" }).waitFor();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByText("PDF brochure selected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Upload to library", exact: true }).click();
  await page.waitForURL(`${base}/admin/media`);
  assert.equal(state.assets[0].mimeType, "application/pdf");
  assert.equal(state.assets[0].visibility, "PRIVATE");
  assert.deepEqual(state.errors, []);
});

test("editing saves visibility and metadata and updates the cached file for reopening", async t => {
  const { page, state } = await setup(t, "media/asset-1/edit");
  await page.getByLabel("Alt text", { exact: true }).fill("Updated landscape description");
  await page.getByRole("radio", { name: /^Private/ }).check();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await page.waitForURL(`${base}/admin/media`);
  const card = page.getByRole("article").filter({ hasText: "Updated landscape description" });
  await card.getByText("PRIVATE", { exact: true }).waitFor();
  await card.getByRole("link", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Alt text", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Alt text", { exact: true }).inputValue(), "Updated landscape description");
  assert(await page.getByRole("radio", { name: /^Private/ }).isChecked());
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].body.sourceNotes, "BR team");
  assert.equal(state.writes[0].body.licenseNotes, "Owned");
  assert.equal(state.writes[0].body.caption, null);
  assert.deepEqual(state.errors, []);
});

test("deleting asks for confirmation, preserves files in use and returns from the last page", async t => {
  const { page, state } = await setup(t);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("article").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(state.writes.length, 0);
  state.inUse = true;
  await page.getByRole("article").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete media file", exact: true }).click();
  await page.getByText("This file is still used by a package.", { exact: true }).waitFor();
  assert.equal(state.assets.length, 26);
  state.inUse = false;
  await page.getByRole("button", { name: "Delete media file", exact: true }).click();
  await page.getByText("25 files in your library", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Preview landscape-1.webp", exact: true }).waitFor();
  assert.equal(state.assets.length, 25);
  assert.deepEqual(state.errors, []);
});
