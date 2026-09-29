import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5202";
let vite, browser;
before(async () => {
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5202", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, API_PROXY_TARGET: "" } });
  for (let attempt = 0; attempt < 100; attempt++) { if (vite.exitCode !== null) throw new Error("Staff test server did not start"); if (await fetch(`${base}/admin/`).then(r => r.ok).catch(() => false)) break; await delay(250); }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });

async function setup(t, path = "users", role = "SUPER_ADMIN") {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  t.after(() => context.close());
  const state = { authenticated: true, user: { id: "owner", email: "owner@example.com", displayName: "Owner", role, status: "ACTIVE" }, staff: { id: "staff", email: "staff@example.com", displayName: "Staff member", role: "SALES_AGENT", status: "ACTIVE" }, writes: [], reads: [], errors: [], failSave: false };
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { authenticated: state.authenticated, user: state.authenticated ? state.user : null, csrfToken: "staff-csrf", publicSiteUrl: base } });
    if (request.method() === "GET") state.reads.push(path);
    else state.writes.push({ path, body: request.postDataJSON(), csrf: request.headers()["x-csrf-token"] });
    if (path === "/admin/dashboard") return json({ data: { packages: 0, publishedPackages: 0, upcomingDepartures: 0, newEnquiries: 0, draftPosts: 0, publishedPosts: 0, enquiryStatusCounts: {}, enquiryTrend: [], generatedAt: "2026-09-25T00:00:00Z" } });
    if (path === "/admin/users" && request.method() === "GET") return json({ data: [state.user, state.staff] });
    if (path.startsWith("/admin/users") && request.method() !== "GET") {
      if (state.failSave) return json({ error: { code: "SAVE_FAILED", message: "Could not save. Please retry." } }, 500);
      const { password, ...input } = request.postDataJSON(); void password;
      Object.assign(state.staff, input);
      return json({ data: state.staff });
    }
    if (path === "/auth/profile") { state.user.displayName = request.postDataJSON().displayName; return json({ data: { user: state.user } }); }
    if (path === "/auth/change-password") {
      if (request.postDataJSON().currentPassword !== "current-password-123") return json({ error: { code: "CURRENT_PASSWORD_INVALID", message: "The current password is incorrect." } }, 400);
      state.authenticated = false; return route.fulfill({ status: 204 });
    }
    assert.equal(request.method(), "GET", `Unexpected write ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded" });
  return { page, state };
}

test("staff creation needs only name, email and password and keeps input after a failed save", async t => {
  const { page, state } = await setup(t, "users/new");
  await page.getByLabel("Name", { exact: true }).fill("New teammate");
  await page.getByLabel("Email address", { exact: true }).fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  assert.equal(await page.getByRole("combobox").count(), 0);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await page.getByRole("alert").getByText(/14 and 128/).waitFor();
  assert.equal(state.writes.length, 0);
  await page.getByLabel("Password", { exact: true }).fill("initial-password-123");
  state.failSave = true;
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await page.getByRole("alert").getByText(/Please retry/).waitFor();
  assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "New teammate");
  state.failSave = false;
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await page.waitForURL(`${base}/admin/users`);
  assert.deepEqual(state.writes.at(-1), { path: "/admin/users", csrf: "staff-csrf", body: { displayName: "New teammate", email: "new@example.com", password: "initial-password-123" } });
  assert.equal(await page.getByRole("columnheader", { name: "Role", exact: true }).count(), 0);
  assert.deepEqual(state.errors, []);
});

test("staff editing keeps passwords unchanged unless requested and validates replacement confirmation", async t => {
  const { page, state } = await setup(t, "users/staff/edit");
  await page.getByLabel("Name", { exact: true }).fill("Updated member");
  assert.equal(await page.getByLabel("New password", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForURL(`${base}/admin/users`);
  assert.deepEqual(state.writes[0].body, { email: "staff@example.com", displayName: "Updated member", status: "ACTIVE" });
  await page.getByRole("row").filter({ hasText: "Updated member" }).getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("New password", { exact: true }).fill("replacement-password-123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("mismatched-password-123");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").getByText(/do not match/).waitFor();
  assert.equal(state.writes.length, 1);
  await page.getByLabel("Confirm new password", { exact: true }).fill("replacement-password-123");
  await page.getByLabel("Email address", { exact: true }).fill("changed@example.com");
  await page.screenshot({ path: join(tmpdir(), "br-staff-edit.png"), fullPage: true });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForURL(`${base}/admin/users`);
  assert.equal(state.writes.at(-1).body.password, "replacement-password-123");
  assert.equal(state.writes.at(-1).body.email, "changed@example.com");
  assert.equal("role" in state.writes.at(-1).body, false);
  assert.deepEqual(state.errors, []);
});

test("removed menus and old links lead to overview or the account editor; staff can change their own password", async t => {
  const { page, state } = await setup(t, "profile", "CONTENT_EDITOR");
  const dialog = page.getByRole("dialog", { name: "Edit my account", exact: true });
  await dialog.waitFor();
  assert.match(new URL(page.url()).pathname, /^\/admin\/?$/);
  for (const name of ["Activity logs", "Environment", "My profile"]) assert.equal(await page.getByRole("link", { name, exact: true }).count(), 0);
  await dialog.getByLabel("Name", { exact: true }).fill("Edited name");
  await dialog.getByRole("button", { name: "Save name", exact: true }).click();
  await page.getByText("Account details updated.", { exact: true }).waitFor();
  assert.equal(state.user.displayName, "Edited name");
  await dialog.getByRole("button", { name: "Change password", exact: true }).click();
  await dialog.getByLabel("Current password", { exact: true }).fill("wrong-password");
  await dialog.getByLabel("New password", { exact: true }).fill("replacement-password-123");
  await dialog.getByLabel("Confirm new password", { exact: true }).fill("replacement-password-123");
  await dialog.getByRole("button", { name: "Save password and sign out", exact: true }).click();
  await dialog.getByRole("alert").getByText(/current password is incorrect/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), "Account dialog overflows on mobile");
  await dialog.getByLabel("Current password", { exact: true }).fill("current-password-123");
  await dialog.getByRole("button", { name: "Save password and sign out", exact: true }).click();
  await page.waitForURL(`${base}/admin/login`);
  assert.deepEqual(state.errors, []);
});

test("activity and environment bookmarks redirect, and the account menu opens editing without a new page", async t => {
  const { page, state } = await setup(t, "audit");
  await page.waitForURL(/\/admin\/?$/);
  await page.goto(`${base}/admin/system/environment`);
  await page.waitForURL(/\/admin\/?$/);
  await page.getByRole("button", { name: "Open profile menu", exact: true }).click();
  await page.getByRole("button", { name: "Edit my account", exact: true }).last().click();
  await page.getByRole("dialog", { name: "Edit my account", exact: true }).waitFor();
  assert.match(new URL(page.url()).pathname, /^\/admin\/?$/);
  assert.equal(state.reads.includes("/admin/audit-logs"), false);
  assert.deepEqual(state.errors, []);
});
