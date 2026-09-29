import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.CATEGORY_TEST_BASE_URL || "http://127.0.0.1:5198";
let vite, browser;
before(async () => {
  if (!process.env.CATEGORY_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, API_PROXY_TARGET: "" } });
    for (let i = 0; i < 120; i++) {
      if (vite.exitCode !== null) throw new Error("Category test server could not start.");
      if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break;
      await delay(250);
    }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });

const category = { id: "family", name: "Family Tours", slug: "family-holidays", description: "Existing category description", status: "PUBLISHED", sortOrder: 0, isDemo: false };
async function setup(t, path = "categories/new") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  t.after(() => context.close());
  const state = { categories: [structuredClone(category)], destinations: [], writes: [], errors: [] };
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", publicSiteUrl: base, authenticated: true, user: { id: "test-admin", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    const match = path.match(/^\/admin\/(categories|destinations)(?:\/([^/]+))?$/);
    if (match) {
      const [, resource, id] = match;
      if (request.method() === "GET") return json({ data: state[resource] });
      const body = request.postDataJSON();
      state.writes.push({ method: request.method(), path, body, csrf: request.headers()["x-csrf-token"] });
      if (request.method() === "PUT") {
        const record = state[resource].find(item => item.id === id);
        Object.assign(record, body);
        return json({ data: record });
      }
      const record = { id: `new-${resource}`, description: null, slug: "server-generated-category", ...body };
      state[resource].push(record);
      return json({ data: record }, 201);
    }
    if (request.method() !== "GET") throw new Error(`Unexpected write: ${request.method()} ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByLabel("Name", { exact: true }).waitFor();
  return { page, state };
}

test("new category saves using its name without slug or description fields", async t => {
  const { page, state } = await setup(t);
  assert.equal(await page.getByLabel("URL slug", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Description", { exact: true }).count(), 0);
  await page.getByLabel("Name", { exact: true }).fill("Adventure Tours");
  await page.screenshot({ path: join(tmpdir(), "br-category-simple-form.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(`${base}/admin/categories`);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0].body, { name: "Adventure Tours", status: "DRAFT", isDemo: false, sortOrder: 0, publishedAt: null });
  assert.equal(state.writes[0].csrf, "test-csrf");
  await page.getByText("Adventure Tours", { exact: true }).waitFor();
  assert.equal(await page.getByText("/server-generated-category", { exact: true }).count(), 0);
  assert.deepEqual(state.errors, []);
});

test("category rename omits hidden fields and retains the existing URL and description", async t => {
  const { page, state } = await setup(t, "categories/family/edit");
  assert.equal(await page.getByLabel("URL slug", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Description", { exact: true }).count(), 0);
  await page.getByLabel("Name", { exact: true }).fill("Family Adventures");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(`${base}/admin/categories`);
  assert.equal(state.writes[0].method, "PUT");
  assert.equal("slug" in state.writes[0].body, false);
  assert.equal("description" in state.writes[0].body, false);
  assert.equal(state.categories[0].slug, "family-holidays");
  assert.equal(state.categories[0].description, category.description);
  await page.getByRole("row").filter({ hasText: "Family Adventures" }).getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Family Adventures");
  assert.deepEqual(state.errors, []);
});

test("category name is required and hidden fields do not block a corrected save", async t => {
  const { page, state } = await setup(t);
  await page.getByLabel("Name", { exact: true }).fill("  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText(/Too small: expected string/).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByRole("textbox", { name: /^Name/ }).fill("  Spiritual Tours  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(`${base}/admin/categories`);
  assert.equal(state.writes[0].body.name, "Spiritual Tours");
  assert.equal("slug" in state.writes[0].body, false);
  assert.deepEqual(state.errors, []);
});
