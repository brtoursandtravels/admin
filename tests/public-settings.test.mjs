import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = process.env.SETTINGS_TEST_BASE_URL || "http://127.0.0.1:5197";
let vite, browser;
before(async () => {
  if (!process.env.SETTINGS_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "/api/v1", VITE_PUBLIC_SITE_URL: base, VITE_API_PROXY_TARGET: "" } });
    for (let i = 0; i < 120; i++) { if (vite.exitCode !== null) throw new Error("Settings test server could not start"); if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break; await delay(250); }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });
async function setup(t, path = "content/settings") {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  t.after(() => context.close());
  const state = { writes: [], errors: [], failSave: false, settings: [
    { key: "contact.phone", value: "+91 79907 21001", isPublic: true },
    { key: "contact.whatsapp", value: "+91 11111 11111", isPublic: true },
    { key: "contact.openingHours", value: "Legacy opening hours", isPublic: true },
    { key: "social.instagram", value: { url: "https://www.instagram.com/br_tours_travels/" }, isPublic: true },
    { key: "seo.pages.home", value: { metaTitle: "Home", metaDescription: "Tours" }, isPublic: true },
  ] };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", authenticated: true, user: { id: "test", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (path === "/admin/settings" && request.method() === "GET") return json({ data: state.settings });
    if (path.startsWith("/admin/settings/") && request.method() === "PUT") {
      const body = request.postDataJSON();
      state.writes.push({ path, body, csrf: request.headers()["x-csrf-token"] });
      if (state.failSave) return json({ error: { code: "SAVE_FAILED", message: "Could not save. Please retry." } }, 500);
      const setting = { key: decodeURIComponent(path.split("/").at(-1)), ...body };
      state.settings = [...state.settings.filter(item => item.key !== setting.key), setting];
      return json({ data: setting });
    }
    assert.equal(request.method(), "GET", `Unexpected write ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("list", { name: "Public settings", exact: true }).waitFor();
  return { page, state };
}

test("settings are plain fields; Enter saves one row and preserves other unsaved edits", async t => {
  const { page, state } = await setup(t);
  assert.equal(await page.getByRole("list", { name: "Public settings", exact: true }).locator("li").count(), 6);
  assert.equal(await page.getByRole("textbox", { name: "Instagram", exact: true }).inputValue(), "https://www.instagram.com/br_tours_travels/");
  assert.equal(await page.getByRole("textbox", { name: /json/i }).count(), 0);
  assert.equal(await page.getByRole("textbox", { name: "WhatsApp number", exact: true }).count(), 0);
  assert.equal(await page.getByRole("textbox", { name: "Opening hours", exact: true }).count(), 0);
  assert.equal(await page.getByRole("textbox", { name: "Phone & WhatsApp number", exact: true }).inputValue(), "+91 79907 21001");
  await page.getByRole("textbox", { name: "Office address", exact: true }).fill("Ahmedabad office");
  const email = page.getByRole("textbox", { name: "Email address", exact: true });
  await email.fill("test@example.com"); await email.press("Enter");
  await page.getByText("Email address saved.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0], { path: "/admin/settings/contact.email", body: { value: "test@example.com", isPublic: true, description: "Email address" }, csrf: "test-csrf" });
  assert.equal(await page.getByRole("textbox", { name: "Office address", exact: true }).inputValue(), "Ahmedabad office");
  await page.getByRole("form", { name: "Office address", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await email.waitFor(); assert.equal(await email.inputValue(), "test@example.com");
  assert.deepEqual(state.errors, []);
});

test("invalid input and failed saves retain edits, retry works, clearing hides and links normalize", async t => {
  const { page, state } = await setup(t);
  const email = page.getByRole("textbox", { name: "Email address", exact: true });
  await email.fill("invalid"); await email.press("Enter");
  await page.getByRole("alert").filter({ hasText: "Enter a valid email address." }).waitFor();
  assert.equal(state.writes.length, 0);
  state.failSave = true;
  await email.fill("test@example.com"); await email.press("Enter");
  await page.getByRole("alert").filter({ hasText: "Could not save. Please retry." }).waitFor();
  assert.equal(await email.inputValue(), "test@example.com");
  state.failSave = false; await email.press("Enter");
  await page.getByText("Email address saved.", { exact: true }).waitFor();
  const instagram = page.getByRole("textbox", { name: "Instagram", exact: true });
  await instagram.fill(""); await instagram.press("Enter");
  await page.getByText("Instagram saved.", { exact: true }).waitFor();
  assert.equal(state.writes.at(-1).body.value, "");
  const facebook = page.getByRole("textbox", { name: "Facebook", exact: true });
  await facebook.fill("www.facebook.com/brtours"); await facebook.press("Enter");
  await page.getByText("Facebook saved.", { exact: true }).waitFor();
  assert.equal(state.writes.at(-1).body.value, "https://www.facebook.com/brtours");
  assert(state.writes.every(write => write.csrf === "test-csrf"));
  assert.deepEqual(state.errors, []);
});

test("old edit links open the list and fields fit laptop and mobile screens", async t => {
  const { page, state } = await setup(t, "content/settings/contact.email/edit");
  await page.waitForURL(`${base}/admin/content/settings`);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${width}`);
    for (const field of ["Email address", "Phone & WhatsApp number", "Instagram", "Facebook"]) {
      const box = await page.getByRole("textbox", { name: field, exact: true }).boundingBox();
      assert(box && box.width > 100 && box.x >= 0 && box.x + box.width <= width);
    }
  }
  assert.deepEqual(state.errors, []);
});


test("the shared phone field saves one canonical value, validates and supports clearing", async t => {
  const { page, state } = await setup(t);
  const phone = page.getByRole("textbox", { name: "Phone & WhatsApp number", exact: true });
  await phone.fill("123"); await phone.press("Enter");
  await page.getByRole("alert").filter({ hasText: "Enter a phone number" }).waitFor();
  assert.equal(state.writes.length, 0);
  await phone.fill("+91 98765 43210"); await phone.press("Enter");
  await page.getByText("Phone & WhatsApp number saved.", { exact: true }).waitFor();
  assert.deepEqual(state.writes[0], { path: "/admin/settings/contact.phone", body: { value: "+91 98765 43210", isPublic: true, description: "Phone & WhatsApp number" }, csrf: "test-csrf" });
  await page.reload(); await phone.waitFor();
  assert.equal(await phone.inputValue(), "+91 98765 43210");
  await phone.fill(""); await phone.press("Enter");
  await page.getByText("Phone & WhatsApp number saved.", { exact: true }).waitFor();
  assert.equal(state.writes.at(-1).body.value, "");
  assert.deepEqual(state.errors, []);
});
