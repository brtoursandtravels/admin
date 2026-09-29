import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.BLOG_TEST_BASE_URL || "http://127.0.0.1:5198";
let vite, browser;
before(async () => {
  if (!process.env.BLOG_TEST_BASE_URL) {
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, API_PROXY_TARGET: "" } });
    for (let i = 0; i < 120; i++) { if (vite.exitCode !== null) throw new Error("Blog test server could not start"); if (await fetch(`${base}/admin/`).then(response => response.ok).catch(() => false)) break; await delay(250); }
  }
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); vite?.kill(); });
const fixture = { id: "story", title: "Rajasthan travel guide", slug: "rajasthan-guide", excerpt: "Explore the forts and desert landscapes of Rajasthan.", contentHtml: '<h2>Plan your visit</h2><p>Discover <strong>beautiful forts</strong> and local markets.</p><ul><li><p>Visit Jaipur</p></li><li><p>Explore Jaisalmer</p></li></ul><h3>Useful advice</h3><blockquote><p>Start early for cooler mornings.</p></blockquote>', status: "PUBLISHED", categoryId: "guides", coverMediaId: null, coverMedia: null, publicAuthorName: "BR Team", publicAuthorBio: "Local travel specialists.", seoTitle: null, seoDescription: null, isFeatured: true, isDemo: true, publishedAt: "2026-09-20T11:20:37.000Z", updatedAt: "2026-09-22T08:00:00.000Z", tags: [{ tag: { id: "family", name: "Family travel", slug: "family-travel" } }], relatedTours: [{ package: { id: "tour", title: "Rajasthan tour" } }], relatedArticles: [] };
async function setup(t, path = "blog/new", overrides = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" });
  t.after(() => context.close());
  const state = { posts: structuredClone([fixture]), categories: [{ id: "guides", name: "Travel guides", slug: "travel-guides", status: "PUBLISHED" }], tags: [{ id: "family", name: "Family travel", slug: "family-travel" }], writes: [], reads: [], errors: [], failSave: false, failTaxonomy: false, ...overrides };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/csrf") return json({ data: { csrfToken: "test-csrf", publicSiteUrl: base, authenticated: true, user: { id: "test", displayName: "Test", email: "test@example.com", role: "SUPER_ADMIN" } } });
    if (path === "/admin/dashboard") return json({ data: { newEnquiries: 0, failedNotifications: 0 } });
    if (request.method() === "GET") state.reads.push(url.pathname + url.search);
    else state.writes.push({ path, method: request.method(), csrf: request.headers()["x-csrf-token"], body: request.postDataJSON() });
    if (path === "/admin/blog/posts" && request.method() === "GET") return json({ data: state.posts.map(({ contentHtml, tags, relatedTours, relatedArticles, ...post }) => { assert.equal(url.searchParams.get("view"), "summary"); return post; }) });
    if (path.startsWith("/admin/blog/posts/") && request.method() === "GET") {
      const post = state.posts.find(post => post.id === path.split("/").at(-1));
      return post ? json({ data: post }) : json({ error: { code: "NOT_FOUND", message: "The article was not found." } }, 404);
    }
    if (path.startsWith("/admin/blog/posts") && ["POST", "PUT"].includes(request.method())) {
      if (state.failSave) return json({ error: { code: "SAVE_FAILED", message: "Article could not save. Please retry." } }, 500);
      const input = request.postDataJSON();
      const post = { ...fixture, ...input, id: request.method() === "POST" ? "created-story" : "story", coverMedia: null, relatedTours: input.relatedPackageIds.map(id => ({ package: { id, title: "Rajasthan tour" } })) };
      const existing = state.posts.findIndex(item => item.id === post.id);
      if (existing >= 0) state.posts[existing] = post; else state.posts.push(post);
      return json({ data: post }, request.method() === "POST" ? 201 : 200);
    }
    if (["/admin/blog/categories", "/admin/blog/tags"].includes(path)) {
      const kind = path.endsWith("categories") ? "categories" : "tags";
      if (request.method() === "POST") {
        if (state.failTaxonomy) return json({ error: { code: "FAILED", message: "Could not add this item. Retry." } }, 500);
        const entry = { ...request.postDataJSON(), id: `new-${kind}`, status: "PUBLISHED" }; state[kind].push(entry); return json({ data: entry }, 201);
      }
      return json({ data: state[kind] });
    }
    if (path === "/admin/packages") return json({ data: [{ id: "tour", title: "Rajasthan tour", status: "PUBLISHED" }], meta: { page: 1, pageSize: 100, total: 1 } });
    assert.equal(request.method(), "GET", `Unexpected write ${path}`);
    return json({ data: [] });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.goto(`${base}/admin/${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return { page, state };
}
const content = page => page.getByRole("textbox", { name: "Article content", exact: true });
async function fillBasics(page) {
  await page.getByLabel("Article title", { exact: true }).fill("A journey through Rajasthan");
  await page.getByLabel("Short description", { exact: true }).fill("Explore beautiful forts and memorable places with BR Tours.");
}

test("new blog validates visible text, formats content, previews unsaved changes and retries saving", async t => {
  const { page, state } = await setup(t);
  await content(page).waitFor();
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.getByText("Write at least 10 characters of article content.", { exact: true }).waitFor();
  assert.equal(state.writes.length, 0);
  await fillBasics(page);
  await content(page).fill("Travel advice for your next journey");
  await content(page).press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  assert.equal(await content(page).locator("strong").innerText(), "Travel advice for your next journey");
  await page.getByRole("combobox", { name: "Text style", exact: true }).click();
  await page.getByRole("option", { name: "Heading", exact: true }).click();
  await content(page).locator("h2").waitFor();
  await page.getByRole("button", { name: "Preview article", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Article preview", exact: true });
  await preview.getByRole("heading", { name: "A journey through Rajasthan", exact: true }).waitFor();
  await preview.locator("h2 strong").waitFor();
  assert.equal(state.writes.length, 0);
  await preview.getByRole("button", { name: "Close Article preview" }).click();
  state.failSave = true;
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.getByText("Article could not save. Please retry.", { exact: true }).first().waitFor();
  assert.match(await content(page).innerHTML(), /<h2><strong>Travel advice/);
  state.failSave = false;
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.waitForURL(`${base}/admin/blog/created-story/edit`);
  await content(page).locator("h2 strong").waitFor();
  const saved = state.writes.at(-1).body;
  assert.match(saved.slug, /^a-journey-through-rajasthan-[a-f0-9]{10}$/);
  assert.match(saved.contentHtml, /<h2><strong>/);
  assert.equal(saved.status, "DRAFT");
  assert.equal(saved.isDemo, false);
  assert(state.writes.every(write => write.csrf === "test-csrf"));
  assert.deepEqual(state.errors, []);
});

test("existing formatting, article addresses, relations and precise publish times survive editing", async t => {
  const { page, state } = await setup(t, "blog/story/edit");
  await content(page).locator("blockquote").waitFor();
  assert.equal(await page.getByRole("link", { name: "Open public article" }).getAttribute("href"), `${base}/blog/${fixture.slug}`);
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Publish date & time", { exact: true }).inputValue(), "2026-09-20T16:50");
  await page.getByLabel("Article title", { exact: true }).fill("Renamed travel story");
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.getByText("Article saved.", { exact: true }).waitFor();
  const saved = state.writes.at(-1).body;
  assert.equal(saved.slug, fixture.slug); assert.equal(saved.publishedAt, fixture.publishedAt); assert.equal(saved.isDemo, true);
  assert.deepEqual(saved.relatedPackageIds, ["tour"]);
  for (const field of ["tagIds", "relatedPostIds", "publicAuthorName", "publicAuthorBio"]) assert.equal(field in saved, false);
  assert.equal(saved.contentHtml, fixture.contentHtml);
  assert(state.reads.includes("/api/v1/admin/blog/posts/story"));
  assert(!state.reads.includes("/api/v1/admin/blog/posts"));
  assert(!state.reads.includes("/api/v1/admin/blog/posts?view=summary"));
  assert(!state.reads.includes("/api/v1/admin/blog/tags"));
  assert.equal(await page.getByLabel("Author name", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Author bio", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("group", { name: "Related articles", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "New tag", exact: true }).count(), 0);
  await page.getByLabel("Publish date & time", { exact: true }).fill("2027-01-10T10:00");
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("All changes saved"));
  assert.equal(state.writes.at(-1).body.publishedAt, "2027-01-10T04:30:00.000Z");
  assert.deepEqual(state.errors, []);
});

test("category creation retains failed input and related tour selection still saves", async t => {
  const { page, state } = await setup(t);
  await content(page).waitFor(); await fillBasics(page); await content(page).fill("A full article with useful travel advice.");
  await page.getByRole("button", { name: "New category", exact: true }).click();
  const category = page.getByRole("dialog", { name: "New blog category" });
  await category.getByLabel("Name", { exact: true }).fill("Trip planning");
  state.failTaxonomy = true;
  await category.getByRole("button", { name: "Add category", exact: true }).click();
  await category.getByText("Could not add this item. Retry.").waitFor();
  assert.equal(await category.getByLabel("Name", { exact: true }).inputValue(), "Trip planning");
  state.failTaxonomy = false;
  await category.getByRole("button", { name: "Add category", exact: true }).click();
  await category.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("combobox", { name: "Category", exact: true }).innerText(), "Trip planning");
  await page.getByText("Related tours", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Rajasthan tour", exact: true }).check();
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await page.waitForURL(`${base}/admin/blog/created-story/edit`);
  const saved = state.writes.at(-1).body;
  assert.equal(saved.categoryId, "new-categories");
  assert.deepEqual(saved.relatedPackageIds, ["tour"]);
  assert.deepEqual(state.errors, []);
});

test("links reject unsafe schemes, formatting can be undone, and mobile tools stay within the screen", async t => {
  const { page, state } = await setup(t);
  await content(page).fill("Explore our travel packages"); await content(page).press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Add or edit link", exact: true }).click();
  await page.getByLabel("Link address", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await page.getByText("Use a website address, email link or phone link.", { exact: true }).waitFor();
  await page.getByLabel("Link address", { exact: true }).fill("https://example.com/packages");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  assert.equal(await content(page).locator("a").getAttribute("href"), "https://example.com/packages");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await content(page).locator("a").count(), 0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await content(page).locator("a").waitFor();
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await content(page).locator("ul li").waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await content(page).scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(tmpdir(), `br-blog-editor-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("heading", { name: "New article", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), "br-blog-editor-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to articles", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Discard unsaved changes?" }).getByRole("button", { name: "Keep editing", exact: true }).click();
  assert.equal(state.writes.length, 0); assert.deepEqual(state.errors, []);
});

test("missing articles show recovery and the blog list uses lightweight summaries", async t => {
  const { page, state } = await setup(t, "blog/missing/edit");
  await page.getByText("The article was not found.", { exact: true }).waitFor();
  await page.goto(`${base}/admin/blog`);
  await page.getByRole("heading", { name: fixture.title, exact: true }).waitFor();
  await page.getByRole("button", { name: "Manage categories", exact: true }).click();
  await page.getByRole("heading", { name: "Blog categories", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Blog tags", exact: true }).count(), 0);
  assert(!state.reads.includes("/api/v1/admin/blog/tags"));
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Article preview", exact: true });
  await preview.locator("h2").getByText("Plan your visit", { exact: true }).waitFor();
  await preview.getByRole("button", { name: "Close Article preview" }).click();
  await page.getByRole("searchbox", { name: "Search articles" }).fill("missing title");
  await page.getByText("No articles found", { exact: true }).waitFor();
  assert(state.reads.includes("/api/v1/admin/blog/posts?view=summary")); assert.deepEqual(state.errors, []);
});
