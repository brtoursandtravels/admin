import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const base = process.env.ENGAGEMENT_TEST_BASE_URL || "http://127.0.0.1:5201";
let vite, browser;

before(async () => {
  if (!process.env.ENGAGEMENT_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5201", "--strictPort"], {
      windowsHide: true,
      stdio: "pipe",
      env: { ...process.env, API_PROXY_TARGET: "" },
    });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (vite.exitCode !== null) throw new Error("Engagement test server could not start.");
      if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break;
      await delay(250);
    }
  }
  browser = await chromium.launch({ headless: true });
});

after(async () => { await browser?.close(); vite?.kill(); });

const past = "2020-09-20T08:00:00.000Z";
const future = "2099-10-01T04:30:00.000Z";
const testimonials = Array.from({ length: 9 }, (_, index) => ({
  id: `story-${index + 1}`,
  publicName: `Traveller ${index + 1}`,
  location: "Ahmedabad",
  tripName: `Journey ${index + 1}`,
  quote: `A thoughtful and well planned journey number ${index + 1}.`,
  rating: 5,
  consentNotes: "Written permission received.",
  approved: index < 8,
  sortOrder: index,
  status: index < 7 ? "PUBLISHED" : index === 7 ? "DRAFT" : "ARCHIVED",
  publishedAt: index < 6 ? past : index === 6 ? future : null,
  isDemo: false,
}));

async function setup(t, route = "content/engagement?view=testimonials", records = testimonials) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: "Asia/Kolkata" });
  t.after(() => context.close());
  const state = { writes: [], errors: [] };
  await context.route("**/api/v1/**", async intercepted => {
    const request = intercepted.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => intercepted.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", publicSiteUrl: base, authenticated: true, user: { id: "test", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0 } });
    if (path === "/admin/faqs" && request.method() === "GET") return json({ data: [{ id: "faq-1", packageId: null, question: "When should I book?", answer: "Book as early as possible.", sortOrder: 0, status: "PUBLISHED", publishedAt: past, isDemo: false }] });
    if (path === "/admin/testimonials" && request.method() === "GET") return json({ data: records });
    if (path === "/admin/packages" && request.method() === "GET") return json({ data: [], meta: { page: 1, pageSize: 100, total: 0 } });
    if (path.startsWith("/admin/testimonials") && ["POST", "PUT"].includes(request.method())) {
      const body = request.postDataJSON();
      state.writes.push({ body, csrf: request.headers()["x-csrf-token"] });
      return json({ data: { id: "new-story", ...body } }, 201);
    }
    assert.equal(request.method(), "GET", `Unexpected write ${request.method()} ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return { page, state };
}

test("testimonial overview explains and counts a nine-story public layout", async t => {
  const { page, state } = await setup(t);
  await page.getByRole("heading", { name: "Traveller testimonials", exact: true }).waitFor();
  const summary = page.getByRole("region", { name: "Testimonial publishing summary", exact: true });
  await summary.locator("strong").first().getByText("9", { exact: true }).waitFor();
  assert.deepEqual(await summary.locator("strong").allTextContents(), ["9", "6", "1", "1"]);
  await page.getByRole("row").filter({ hasText: "Traveller 7" }).getByText("SCHEDULED", { exact: true }).waitFor();
  await page.getByText(/one sliding row: up to 3 cards on laptops, 2 on tablets and 1 on phones/).waitFor();
  assert.equal(await page.getByText(/Demo content/i).count(), 0);
  assert.equal(await page.getByRole("row").count(), 10);
  await page.screenshot({ path: join(tmpdir(), "br-engagement-testimonials.png"), fullPage: true });
  for (const width of [1366, 1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Engagement page overflow at ${width}px`);
  }
  assert.deepEqual(state.errors, []);
});

test("publishing is a single action that requires permission and saves immediately without a date", async t => {
  const { page, state } = await setup(t, "content/engagement/testimonials/new");
  await page.getByLabel("Public name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel(/demo/i).count(), 0);
  await page.getByLabel("Public name", { exact: true }).fill("Asha Patel");
  await page.getByLabel(/^Quote/).fill("The whole journey was planned clearly and comfortably.");
  assert.equal(await page.getByLabel("Approved for public display", { exact: true }).count(), 0);
  await page.getByLabel("Website status", { exact: true }).click();
  await page.getByRole("option", { name: "Published — show on website", exact: true }).click();
  assert(await page.getByRole("button", { name: "Save testimonial", exact: true }).isDisabled());
  await page.getByLabel(/^Traveller permission notes/).fill("Email permission received.");
  await page.getByText("Ready to show on the website", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save testimonial", exact: true }).click();
  await page.waitForURL(`${base}/admin/content/engagement?view=testimonials`);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].body.isDemo, false);
  assert.equal(state.writes[0].body.status, "PUBLISHED");
  assert.equal(state.writes[0].body.approved, true);
  assert.equal(state.writes[0].body.publishedAt, null);
  assert.equal(state.writes[0].csrf, "test-csrf");
  assert.deepEqual(state.errors, []);
});

test("editing a scheduled testimonial preserves its local time and saves changes in UTC", async t => {
  const { page, state } = await setup(t, "content/engagement/testimonials/story-7/edit");
  const date = page.getByLabel("Show on website from (optional)", { exact: true });
  await date.waitFor();
  assert.equal(await date.inputValue(), "2099-10-01T10:00");
  await page.getByText("Scheduled for the website", { exact: true }).waitFor();
  await page.getByText(/No second save is needed/).waitFor();
  await date.fill("2099-10-02T11:15");
  await page.getByRole("button", { name: "Save testimonial", exact: true }).click();
  await page.waitForURL(`${base}/admin/content/engagement?view=testimonials`);
  assert.equal(state.writes[0].body.publishedAt, "2099-10-02T05:45:00.000Z");
  assert.equal(state.writes[0].body.approved, true);
  assert.deepEqual(state.errors, []);
});

test("legacy unapproved testimonials remain drafts until explicitly published", async t => {
  const legacy = { ...testimonials[0], id: "demo-testimonial-draft", status: "PUBLISHED", approved: false, consentNotes: null, isDemo: true, publishedAt: future };
  const { page, state } = await setup(t, `content/engagement/testimonials/${legacy.id}/edit`, [legacy]);
  await page.getByLabel("Public name", { exact: true }).waitFor();
  await page.getByLabel("Website status", { exact: true }).getByText("Draft — hidden", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Show on website from (optional)", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Save testimonial", exact: true }).click();
  await page.waitForURL(`${base}/admin/content/engagement?view=testimonials`);
  assert.equal(state.writes[0].body.status, "DRAFT");
  assert.equal(state.writes[0].body.approved, false);
  assert.equal(state.writes[0].body.isDemo, false);
  assert.deepEqual(state.errors, []);
});
