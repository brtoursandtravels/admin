import { expect, test, type Page } from "@playwright/test";

const password = "Playwright-Only-Password-2026!";
const suffix = Date.now().toString(36);

async function login(page: Page, email: string) {
  await page.goto("login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
}

test("Super Admin creates, previews, publishes, reloads and unpublishes a package", async ({
  page,
}) => {
  await login(page, "e2e-super@example.invalid");

  await page.goto("destinations");
  await page.getByRole("button", { name: "New destination" }).click();
  await page.getByLabel("Name").fill(`E2E Destination ${suffix}`);
  await page.getByLabel("URL slug").fill(`e2e-destination-${suffix}`);
  await page
    .getByLabel("Description")
    .fill("Playwright-only destination used to verify the real CMS workflow.");
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText(`E2E Destination ${suffix}`, { exact: true }).first(),
  ).toBeVisible();

  await page.goto("categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Name").fill(`E2E Category ${suffix}`);
  await page.getByLabel("URL slug").fill(`e2e-category-${suffix}`);
  await page
    .getByLabel("Description")
    .fill("Playwright-only category used to verify package relations.");
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText(`E2E Category ${suffix}`, { exact: true }).first(),
  ).toBeVisible();

  await page.goto("packages/new");
  await page.getByLabel("Title").fill(`E2E Journey ${suffix}`);
  await page.getByLabel("URL slug").fill(`e2e-journey-${suffix}`);
  await page.getByLabel("Days").fill("4");
  await page.getByLabel("Nights").fill("3");
  await page.getByLabel("Starting city").fill("Test City");
  await page
    .getByLabel("Destinations")
    .selectOption({ label: `E2E Destination ${suffix} · PUBLISHED` });
  await page
    .getByLabel("Categories")
    .selectOption({ label: `E2E Category ${suffix} · PUBLISHED` });
  await page.getByRole("tab", { name: "Content" }).click();
  await page
    .getByLabel("Summary")
    .fill(
      "A Playwright-only package summary for the protected admin workflow.",
    );
  await page
    .getByLabel("Overview")
    .fill(
      "This integration fixture verifies create, edit, preview, publication and reload against the real MySQL API.",
    );
  await page.getByRole("tab", { name: "Itinerary" }).click();
  await page.getByRole("button", { name: "Add day" }).click();
  await page.getByLabel("Title").last().fill("Arrival and orientation");
  await page
    .getByLabel("Description")
    .last()
    .fill("A clearly labelled integration itinerary day.");
  await page.getByRole("button", { name: "Save package" }).last().click();
  await expect(page).toHaveURL(/packages\/[^/]+\/edit$/);
  await expect(
    page.getByText("Package created as a real database record."),
  ).toBeVisible();

  const editUrl = page.url();
  await page.getByRole("link", { name: "Protected preview" }).click();
  await expect(
    page.getByRole("heading", { name: `E2E Journey ${suffix}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Protected draft preview")).toBeVisible();
  await page.goto(editUrl);
  await page.getByRole("tab", { name: "Publishing" }).click();
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save package" }).last().click();
  await expect(page.getByText("Package saved.")).toBeVisible();

  const publicResponse = await page.request.get(
    `/api/v1/packages/e2e-journey-${suffix}`,
  );
  expect(publicResponse.status()).toBe(200);
  await page.reload();
  await page.getByRole("tab", { name: "Basics" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(`E2E Journey ${suffix}`);

  await page.getByRole("tab", { name: "Publishing" }).click();
  await page.getByLabel("Status").selectOption("DRAFT");
  await page.getByRole("button", { name: "Save package" }).last().click();
  await expect
    .poll(async () =>
      (
        await page.request.get(`/api/v1/packages/e2e-journey-${suffix}`)
      ).status(),
    )
    .toBe(404);
});

test("Content Editor and Sales Agent receive both UI and API permission boundaries", async ({
  page,
}) => {
  await login(page, "e2e-editor@example.invalid");
  await expect(page.getByRole("link", { name: "Packages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enquiries" })).toHaveCount(0);
  expect(
    await page.evaluate(
      async () =>
        (await fetch("/api/v1/admin/inquiries", { credentials: "include" }))
          .status,
    ),
  ).toBe(403);
  await page.goto("enquiries");
  await expect(
    page.getByRole("heading", { name: "Access is not available." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "e2e-sales@example.invalid");
  await expect(page.getByRole("link", { name: "Enquiries" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Packages" })).toHaveCount(0);
  expect(
    await page.evaluate(
      async () =>
        (await fetch("/api/v1/admin/packages", { credentials: "include" }))
          .status,
    ),
  ).toBe(403);
  await page.goto("packages");
  await expect(
    page.getByRole("heading", { name: "Access is not available." }),
  ).toBeVisible();
});

test("nested routes refresh and mobile navigation remains keyboard reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "e2e-super@example.invalid");
  await page.goto("content/pages");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pages and policies" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).focus();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Admin sections" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
