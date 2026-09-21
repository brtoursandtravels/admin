import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = process.env.DELETE_TEST_BASE_URL || "http://127.0.0.1:5192";
let vite;
let browser;
before(async () => {
  if (!process.env.DELETE_TEST_BASE_URL) {
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5192", "--strictPort"], {
    windowsHide: true, stdio: "pipe",
    env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_PUBLIC_SITE_URL: base, VITE_API_PROXY_TARGET: "" },
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (vite.exitCode !== null) throw new Error("The test Vite server could not start.");
    if (await fetch(`${base}/admin/`).then((r) => r.ok).catch(() => false)) break;
    await delay(250);
  }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });

const fixture = {
  id: "test-package", title: "Test mountain tour", slug: "test-mountain-tour", status: "DRAFT",
  days: 2, nights: 1, basePrice: "2500.00", currency: "INR", priceBasis: "PER_PERSON", isDemo: false,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", publishedAt: null,
  summary: "A test-only mountain itinerary.", overview: "A test-only mountain itinerary.",
  highlights: [], inclusions: [], exclusions: [], destinations: [], categories: [], departures: [], media: [],
  itinerary: [{ dayNumber: 1, title: "Arrival", description: "Arrive at the mountains.", activities: [] },
    { dayNumber: 2, title: "Return", description: "Return home.", activities: [] }],
};
async function setup(t, options = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const state = { rows: [structuredClone(fixture)], deletes: [], fail: false, release: null, errors: [] };
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "DELETE") {
      state.deletes.push({ path, csrf: request.headers()["x-csrf-token"] });
      if (options.pause) await new Promise((resolve) => { state.release = resolve; });
      if (state.fail) return json({ error: { code: "DELETE_FAILED", message: "Deletion failed. Please retry." } }, 500);
      state.rows = [];
      return route.fulfill({ status: 204 });
    }
    if (request.method() !== "GET") throw new Error(`Unexpected write: ${request.method()} ${path}`);
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", authenticated: true, user: { id: "test-admin", displayName: "Test admin", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (path === "/admin/packages") return json({ data: state.rows, meta: { page: Number(url.searchParams.get("page") || 1), pageSize: 25, total: state.rows.length + (options.secondPage ? 25 : 0) } });
    if (path === "/admin/packages/test-package") return json({ data: fixture });
    if (path === "/admin/media") return json({ data: [], meta: { page: 1, pageSize: 100, total: 0 } });
    return json({ data: [] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.goto(`${base}/admin/packages${options.secondPage ? "?page=2" : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Delete", exact: true }).waitFor();
  return { page, state };
}

test("Cancel, Enter on Cancel and Escape never issue a deletion", async (t) => {
  const { page, state } = await setup(t);
  const trigger = page.getByRole("button", { name: "Delete", exact: true });
  for (const action of ["click", "enter", "escape"]) {
    await trigger.click();
    const dialog = page.getByRole("alertdialog");
    assert.match(await dialog.innerText(), /Test mountain tour/);
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    assert.equal(await cancel.evaluate((element) => element === document.activeElement), true);
    if (action === "click") await cancel.click();
    else if (action === "enter") { await cancel.focus(); await page.keyboard.press("Enter"); }
    else await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(state.deletes.length, 0);
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
  }
  assert.deepEqual(state.errors, []);
});

test("confirmation sends one authenticated delete, blocks double-clicks and refreshes the list", async (t) => {
  const { page, state } = await setup(t, { pause: true });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Delete package", exact: true }).evaluate((button) => { button.click(); button.click(); });
  await page.waitForFunction(() => document.querySelector('[role="alertdialog"] button:last-child')?.disabled);
  for (let i = 0; !state.release && i < 40; i++) await delay(50);
  assert.equal(state.deletes.length, 1);
  assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true);
  state.release();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("No packages match", { exact: true }).waitFor();
  assert.deepEqual(state.deletes, [{ path: "/admin/packages/test-package/permanent", csrf: "test-csrf" }]);
  assert.deepEqual(state.errors, []);
});

test("API errors stay in the dialog and leave the row available for retry", async (t) => {
  const { page, state } = await setup(t);
  state.fail = true;
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Delete package", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.match(await dialog.getByRole("alert").innerText(), /Please retry/);
  assert.equal(state.rows.length, 1);
  state.fail = false;
  await dialog.getByRole("button", { name: "Delete package", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(state.rows.length, 0);
});

test("deleting the final row on a later page returns to the previous page", async (t) => {
  const { page } = await setup(t, { secondPage: true });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete package", exact: true }).click();
  await page.waitForURL(/page=1/);
});

test("itinerary removal uses confirmation and stays unsaved until the package is saved", async (t) => {
  const { page, state } = await setup(t);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Itinerary", exact: true }).click();
  const rows = page.locator("legend").filter({ hasText: /^Day \d+$/ }).locator("..");
  assert.equal(await rows.count(), 2);
  await rows.first().getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await rows.count(), 2);
  await rows.first().getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove itinerary day", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  assert.equal(await rows.count(), 1);
  assert.equal(state.deletes.length, 0);
  await page.getByText("Unsaved changes", { exact: true }).waitFor();
});
