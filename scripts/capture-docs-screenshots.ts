/**
 * Captures the screenshots used in docs/final/User_Guide.md from the running app, with the fictional demo data.
 *
 * Run with the app running on localhost:3000 (npm run dev) and E2E_PASSWORD set in .env.local:
 *   npx playwright test --config scripts/capture-docs.config.ts
 *
 * It signs in as the demo buyer (Mei's Noodle House), supplier (Harbour Dry Goods), operations lead (Hannah)
 * and an operator (Grace). It only opens forms; it never submits them. The only writes are a cart draft for
 * the buyer (two products added) and one Tradelink AI chat message, which asks Claude a question.
 */
import { test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join("docs", "final", "assets", "screenshots");
const LAPTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const ACCOUNTS = {
  buyer: "mei@noodlehouse.example",
  supplier: "priya@harbourdry.example",
  lead: "hannah@tradelink.example",
  operator: "grace@tradelink.example",
};

type Size = "laptop" | "phone";
type Callout = { target: Locator; n: number };

const failures: string[] = [];
const saved: string[] = [];

/** Hides the Next.js dev indicator and toasts' motion so screenshots are steady. */
async function tidy(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; } *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }",
  });
}

/** Numbered markers drawn just left of each target, removed after the shot. */
async function addCallouts(page: Page, callouts: Callout[]): Promise<void> {
  for (const { target, n } of callouts) {
    const box = await target.first().boundingBox({ timeout: 3_000 }).catch(() => null);
    if (!box) continue;
    await page.evaluate(
      ({ x, y, h, n }) => {
        const dot = document.createElement("div");
        dot.className = "docs-callout";
        dot.textContent = String(n);
        Object.assign(dot.style, {
          position: "absolute",
          left: `${Math.max(2, x + window.scrollX - 30)}px`,
          top: `${y + window.scrollY + h / 2 - 12}px`,
          width: "24px",
          height: "24px",
          borderRadius: "999px",
          background: "#D9480F",
          color: "#fff",
          font: "700 13px/24px system-ui, sans-serif",
          textAlign: "center",
          zIndex: "2147483647",
          boxShadow: "0 0 0 2px #fff",
        });
        document.body.appendChild(dot);
      },
      { x: box.x, y: box.y, h: box.height, n },
    );
  }
}

async function clearCallouts(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelectorAll(".docs-callout").forEach((dot) => dot.remove()));
}

/** Saves one screenshot. `area` is "viewport", "full" or a locator to crop to. */
async function shot(page: Page, name: string, area: "viewport" | "full" | Locator = "viewport", callouts: Callout[] = []): Promise<void> {
  const file = path.join(OUT, `${name}.png`);
  try {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await tidy(page);
    await addCallouts(page, callouts);
    if (area === "viewport" || area === "full") await page.screenshot({ path: file, fullPage: area === "full" });
    else await area.first().screenshot({ path: file });
    await clearCallouts(page);
    saved.push(name);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}

async function setSize(page: Page, size: Size): Promise<void> {
  await page.setViewportSize(size === "laptop" ? LAPTOP : PHONE);
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  const url = new URL(page.url());
  await page.context().addCookies([{ name: "tl-theme", value: theme, domain: url.hostname, path: "/" }]);
}

/** Opens the first visible row in a list whose text matches, using its row link. Returns false if there is none. */
async function openRow(page: Page, text: RegExp): Promise<boolean> {
  try {
    const link = page.locator("a[data-row-link], main a[href*='/orders/'], main a[href*='/suppliers/']").filter({ hasText: text, visible: true }).first();
    // Lists stream in, so give the row a moment to appear before deciding there is none.
    await link.waitFor({ timeout: 10_000 }).catch(() => undefined);
    if ((await link.count()) > 0) {
      await link.click();
    } else {
      const row = page.locator("main tr, main li").filter({ hasText: text, visible: true }).first();
      if ((await row.count()) === 0) return false;
      await row.click();
    }
    await page.waitForLoadState("networkidle").catch(() => undefined);
    return true;
  } catch (error) {
    failures.push(`open row ${text}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return false;
  }
}

test("capture documentation screenshots", async ({ page }) => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD in .env.local to sign in as the demo accounts.");
  fs.mkdirSync(OUT, { recursive: true });

  // Signed out
  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/sign-in");
    await shot(page, `auth-sign-in-${size}`);
  }
  await setSize(page, "laptop");
  await page.goto("/sign-up");
  await shot(page, "auth-sign-up-laptop", "full");
  await page.goto("/forgot-password");
  await shot(page, "auth-forgot-password-laptop");

  // Buyer: Mei's Noodle House
  await setSize(page, "laptop");
  await signIn(page, ACCOUNTS.buyer);
  await setTheme(page, "light");
  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/buyer");
    await shot(page, `buyer-home-${size}`, "viewport", size === "laptop" ? [
      { target: page.getByRole("region", { name: "Next up" }), n: 1 },
      { target: page.getByRole("button", { name: "Alerts" }), n: 2 },
    ] : []);
  }
  await setSize(page, "laptop");
  await setTheme(page, "dark");
  await page.goto("/buyer");
  await shot(page, "buyer-home-dark-laptop");
  await setTheme(page, "light");

  await page.goto("/buyer");
  await page.getByRole("button", { name: "Alerts" }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await shot(page, "buyer-alerts-panel-laptop");
  await page.keyboard.press("Escape");

  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/buyer/products");
    await shot(page, `buyer-products-${size}`);
  }

  // Cart: add two products if it is empty (a draft only; nothing is ordered).
  await setSize(page, "laptop");
  await page.goto("/buyer/cart");
  if (await page.getByText("Your cart is empty").count()) {
    await page.goto("/buyer/products");
    const adds = page.getByRole("button", { name: /^Add to cart, / });
    for (let i = 0; i < 2 && i < (await adds.count()); i += 1) {
      await adds.nth(i).click();
      await page.waitForTimeout(1200);
    }
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/buyer/cart");
    await page.waitForTimeout(1000);
    await shot(page, `buyer-cart-review-${size}`, size === "laptop" ? "full" : "viewport", size === "laptop" ? [
      { target: page.getByText(/^Checked/), n: 1 },
      { target: page.getByRole("button", { name: /^Place / }), n: 2 },
    ] : []);
  }

  // Tradelink AI: one real question to Claude.
  await setSize(page, "laptop");
  await page.goto("/buyer/assistant");
  const box = page.getByPlaceholder("Ask anything, or tell me what to do");
  if (fs.existsSync(path.join(OUT, "buyer-tradelink-ai-confirm-laptop.png")) && !process.env.DOCS_RECAPTURE_AI) {
    // Keep the existing chat screenshot: each capture asks Claude a real question. Set DOCS_RECAPTURE_AI=1 to redo it.
    saved.push("buyer-tradelink-ai-confirm-laptop (kept)");
  } else if (await box.count()) {
    await box.fill("Add 2 packets of dried noodles to my cart");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByRole("button", { name: /Add to cart|Confirm/ }).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await shot(page, "buyer-tradelink-ai-confirm-laptop");
  } else {
    failures.push("buyer-tradelink-ai-confirm-laptop: chat box not found");
  }

  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/buyer/orders");
    await shot(page, `buyer-orders-${size}`);
  }

  await setSize(page, "laptop");
  // Orders out for delivery and not yet checked show "Check delivery" in the list.
  await page.goto("/buyer/orders?filter=to_check");
  if (await openRow(page, /Check delivery/)) {
    await shot(page, "buyer-order-out-for-delivery-laptop", "full", [
      { target: page.getByRole("button", { name: "All here" }), n: 1 },
      { target: page.getByRole("button", { name: /Not here yet/ }), n: 2 },
      { target: page.getByRole("button", { name: "Report a problem" }), n: 3 },
    ]);
    await page.getByRole("button", { name: "Report a problem" }).first().click().catch(() => undefined);
    await page.waitForTimeout(800);
    await shot(page, "buyer-report-problem-laptop", "viewport");
  } else failures.push("buyer order out for delivery: no row");

  await page.goto("/buyer/orders?filter=problems");
  await shot(page, "buyer-orders-problems-laptop");
  if (await openRow(page, /ISS.\d|ORD.\d/)) await shot(page, "buyer-order-problem-laptop", "full");

  await page.goto("/buyer/insights");
  await shot(page, "buyer-insights-laptop", "full");
  await page.goto("/buyer/settings");
  await shot(page, "buyer-settings-laptop", "full");
  await page.goto("/buyer/notifications");
  await shot(page, "buyer-notifications-laptop");

  // Supplier: Harbour Dry Goods
  await setSize(page, "laptop");
  await signIn(page, ACCOUNTS.supplier);
  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/supplier");
    await shot(page, `supplier-home-${size}`);
    await page.goto("/supplier/orders");
    await shot(page, `supplier-orders-${size}`);
    await page.goto("/supplier/inventory");
    await shot(page, `supplier-inventory-${size}`);
  }
  await setSize(page, "laptop");
  await setTheme(page, "dark");
  await page.goto("/supplier/orders");
  await shot(page, "supplier-orders-dark-laptop");
  await setTheme(page, "light");

  // Order numbers use a non-breaking hyphen ("ORD‑1090"), so match any character between ORD and the digits.
  await page.goto("/supplier/orders?filter=new");
  if (await openRow(page, /ORD.\d/)) {
    await shot(page, "supplier-order-new-laptop", "full", [
      { target: page.getByRole("button", { name: "Accept order" }), n: 1 },
      { target: page.getByRole("button", { name: "Part accept" }), n: 2 },
      { target: page.getByRole("button", { name: "Reject order" }), n: 3 },
    ]);
    await page.getByRole("button", { name: "Part accept" }).first().click().catch(() => undefined);
    await page.waitForTimeout(800);
    await shot(page, "supplier-part-accept-laptop", "full");
  } else failures.push("supplier new order: no row");

  await page.goto("/supplier/orders?filter=to_pack");
  if (await openRow(page, /ORD.\d/)) await shot(page, "supplier-order-to-pack-laptop", "full");

  await page.goto("/supplier/orders?filter=delivered");
  await shot(page, "supplier-orders-delivered-laptop");

  await page.goto("/supplier/inventory");
  const receive = page.getByRole("button", { name: "Receive stock" }).first();
  if (await receive.count()) {
    await receive.click();
    await page.waitForTimeout(800);
    await shot(page, "supplier-receive-stock-laptop");
    await page.keyboard.press("Escape");
  }
  await page.goto("/supplier/activity");
  await shot(page, "supplier-activity-laptop");
  await page.goto("/supplier/stock-history");
  await shot(page, "supplier-stock-history-laptop");
  await page.goto("/supplier/settings");
  await shot(page, "supplier-settings-laptop", "full");

  // Admin: Hannah, the operations lead
  await setSize(page, "laptop");
  await signIn(page, ACCOUNTS.lead);
  for (const size of ["laptop", "phone"] as const) {
    await setSize(page, size);
    await page.goto("/admin");
    await shot(page, `admin-home-${size}`);
    await page.goto("/admin/attention");
    await shot(page, `admin-attention-${size}`);
  }
  await setSize(page, "phone");
  await page.goto("/admin");
  await page.getByRole("button", { name: /More/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await shot(page, "admin-more-sheet-phone");

  await setSize(page, "laptop");
  await page.goto("/admin/attention?filter=high");
  await shot(page, "admin-attention-high-laptop", "viewport", [{ target: page.getByLabel("Assigned to"), n: 1 }]);
  await setTheme(page, "dark");
  await page.goto("/admin/attention");
  await shot(page, "admin-attention-dark-laptop");
  await setTheme(page, "light");

  await page.goto("/admin/suppliers");
  await shot(page, "admin-suppliers-laptop");
  if (await openRow(page, /Harbour Dry Goods/)) await shot(page, "admin-supplier-detail-laptop", "full");
  await page.goto("/admin/users");
  await shot(page, "admin-users-laptop");
  await page.goto("/admin/operators");
  await shot(page, "admin-operators-laptop");
  await page.goto("/admin/orders");
  await shot(page, "admin-orders-laptop");
  await page.goto("/admin/audit");
  await shot(page, "admin-audit-laptop");
  await page.goto("/admin/notifications");
  await shot(page, "admin-notifications-laptop");

  // Admin: Grace, an operator who sees only her own items
  await signIn(page, ACCOUNTS.operator);
  await page.goto("/admin/attention");
  await shot(page, "admin-attention-operator-laptop");

  console.log(`Saved ${saved.length} screenshots to ${OUT}`);
  if (failures.length) console.log(`Not captured:\n- ${failures.join("\n- ")}`);
});
