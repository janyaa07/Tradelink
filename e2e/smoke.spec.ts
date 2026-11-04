import { expect, test } from "@playwright/test";

// A fictional Tradelink AI owner from supabase/tradelink-ai-mock-data.sql. Override for other environments.
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "tan@kopicorner.example";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_PASSWORD ?? "";

test("the sign-in page renders", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("the web app manifest is served for Tradelink AI", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; purpose?: string }>;
  };
  expect(manifest).toMatchObject({ name: "Tradelink AI", short_name: "Tradelink AI", start_url: "/", display: "standalone" });
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }

  await page.goto("/sign-in");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
});

test("the service worker script is served", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("javascript");
});

test("the offline page renders without signing in", async ({ page }) => {
  await page.goto("/offline");
  await expect(page).toHaveURL(/\/offline$/);
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/");
});

test("a signed-in Tradelink AI owner reaches /r", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);

  // The sign-in action sends people without a Tradelink organisation to "/", which the proxy forwards
  // to /r, so open /r directly to check the session is allowed there.
  await page.goto("/r");
  await expect(page).toHaveURL(/\/r(?:[/?#]|$)/);
  await expect(page.getByRole("alertdialog", { name: "Update Tradelink AI to keep ordering" })).toHaveCount(0);
});

test("the service worker shows the offline page when the network is gone", async ({ page, context }) => {
  // Development builds do not register the worker on their own (NEXT_PUBLIC_ENABLE_SW), so register it here.
  await page.goto("/offline");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  expect(await page.evaluate(async () => Boolean(await caches.match("/offline")))).toBe(true);

  // Playwright's offline mode does not reach service worker fetches, so fail the worker's network instead.
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await worker.evaluate(() => {
    self.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  });

  await page.goto("/r/anything");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await expect(page).toHaveURL(/\/r\/anything$/);
});
