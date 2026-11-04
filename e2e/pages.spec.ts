import { expect, test } from "@playwright/test";
import { BUYER_EMAIL, signIn, SUPPLIER_EMAIL, watchForErrors } from "./helpers";

/** Every page of each role opens with its heading and no error screen, on a laptop and a phone. Read-only. */
const PAGES = {
  [BUYER_EMAIL]: [
    ["/buyer", /^Good (morning|afternoon|evening)/],
    ["/buyer/assistant", /^Good (morning|afternoon|evening)/],
    ["/buyer/orders", "Orders"],
    ["/buyer/products", "Products"],
    ["/buyer/cart", "Cart"],
    ["/buyer/insights", "Insights"],
    ["/buyer/notifications", "Alerts"],
    ["/buyer/settings", "Settings"],
  ],
  [SUPPLIER_EMAIL]: [
    ["/supplier", /^Good (morning|afternoon|evening)/],
    ["/supplier/assistant", /^Good (morning|afternoon|evening)/],
    ["/supplier/orders", "Orders"],
    ["/supplier/inventory", "Inventory"],
    ["/supplier/activity", "Activity"],
    ["/supplier/stock-history", "Stock history"],
    ["/supplier/notifications", "Notifications"],
    ["/supplier/settings", "Settings"],
  ],
} as const;

for (const [email, pages] of Object.entries(PAGES)) {
  test(`every page opens for ${email}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchForErrors(page);
    await signIn(page, email);
    for (const [path, heading] of pages) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.getByText("Something went wrong")).toHaveCount(0);
        // Nothing wider than the screen, so a phone never scrolls sideways.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
      });
    }
    expect(errors, "uncaught errors").toEqual([]);
  });
}
