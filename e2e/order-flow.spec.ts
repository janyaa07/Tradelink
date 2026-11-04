import { expect, test } from "@playwright/test";
import { BUYER_EMAIL, pageFor, SUPPLIER_EMAIL, TEST_NOTE, TEST_PRODUCT, watchForErrors } from "./helpers";

/**
 * The whole order life cycle across both roles, on the real database: the buyer orders, the supplier
 * accepts, sends out and delivers, the buyer reports a short item, the supplier credits it and the
 * buyer records the credit. Each run leaves one small order, marked with TEST_NOTE.
 */
test("an order goes from cart to delivered, and a short item is credited", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Writes real records, so it runs once per run, on the laptop project.");
  test.setTimeout(240_000);

  const buyer = await pageFor(browser, BUYER_EMAIL);
  const supplier = await pageFor(browser, SUPPLIER_EMAIL);
  const buyerErrors = watchForErrors(buyer);
  const supplierErrors = watchForErrors(supplier);
  let orderNumber = "";
  let orderHref = "";

  await test.step("the buyer starts with an empty cart", async () => {
    // Leftovers from a run that stopped half way. Wait for the page to be ready, and for each save.
    await buyer.goto("/buyer/cart", { waitUntil: "networkidle" });
    const remove = buyer.getByRole("button", { name: /^Remove / });
    while ((await remove.count()) > 0) {
      await remove.first().click();
      await buyer.waitForLoadState("networkidle");
    }
    await buyer.reload({ waitUntil: "networkidle" });
    await expect(buyer.getByText("Your cart is empty")).toBeVisible();
  });

  await test.step("the buyer adds one product and places the order", async () => {
    await buyer.goto("/buyer/products", { waitUntil: "networkidle" });
    await buyer.getByRole("button", { name: `Add to cart, ${TEST_PRODUCT}` }).click();
    await expect(buyer.getByRole("group", { name: `${TEST_PRODUCT} in cart` })).toBeVisible();
    // The tile updates at once; the toast means the cart is saved.
    await expect(buyer.getByText(`${TEST_PRODUCT} added to cart.`)).toBeVisible();

    await buyer.goto("/buyer/cart");
    await expect(buyer.getByText(TEST_PRODUCT).first()).toBeVisible();
    await buyer
      .getByRole("button", { name: /^Place order/ })
      .first()
      .click();
    await expect(buyer).toHaveURL(/\/buyer\/orders/);

    const newest = buyer.getByRole("link", { name: /^ORD-\d+$/ }).first();
    orderNumber = (await newest.textContent())?.trim() ?? "";
    orderHref = (await newest.getAttribute("href")) ?? "";
    expect(orderNumber).toMatch(/^ORD-\d+$/);
    await expect(buyer.getByRole("row").filter({ hasText: orderNumber })).toContainText("Pending");
  });

  await test.step("the supplier accepts it for the default date", async () => {
    await supplier.goto(`/supplier/orders?q=${orderNumber}`);
    await supplier.getByRole("button", { name: `Accept order, ${orderNumber}` }).click();
    await supplier.getByRole("button", { name: "Accept order", exact: true }).click();
    await expect(supplier.getByRole("button", { name: `Mark out for delivery, ${orderNumber}` })).toBeVisible();
  });

  await test.step("the supplier sends it out and delivers it", async () => {
    await supplier.getByRole("button", { name: `Mark out for delivery, ${orderNumber}` }).click();
    await supplier.getByRole("button", { name: `Mark delivered, ${orderNumber}` }).click();
    await expect(supplier.getByRole("row").filter({ hasText: orderNumber })).toContainText("Delivered");
  });

  await test.step("the buyer is told at each step", async () => {
    await buyer.goto("/buyer/notifications");
    for (const update of [`${orderNumber} accepted`, `${orderNumber} is on the way`, `${orderNumber} delivered`]) {
      await expect(buyer.getByRole("link", { name: new RegExp(`^${update}`) })).toBeVisible();
    }
  });

  await test.step("the buyer reports one item short", async () => {
    await buyer.goto(orderHref);
    await expect(buyer.getByText("Check delivery").first()).toBeVisible();
    await buyer.getByRole("button", { name: "Report a problem" }).click();
    await buyer.getByLabel("What happened").selectOption("short");
    await buyer.getByLabel("Quantity affected").fill("1");
    await buyer.getByLabel("Note (optional)").fill(TEST_NOTE);
    await buyer.getByRole("button", { name: "Send to supplier" }).click();
    await expect(buyer.getByText(/Problem sent to/)).toBeVisible();
    // The order page shows the problem without a reload.
    await expect(buyer.getByText(`Short: 1 × ${TEST_PRODUCT}`)).toBeVisible();
    await expect(buyer.getByText("Problem reported").first()).toBeVisible();
  });

  await test.step("the supplier offers a credit", async () => {
    await supplier.goto("/supplier/orders");
    const problem = supplier.getByRole("listitem").filter({ hasText: orderNumber }).filter({ hasText: TEST_NOTE });
    await problem.getByRole("button", { name: /^Credit S\$/ }).click();
    await expect(problem).toHaveCount(0);
  });

  await test.step("the buyer sees the reply and records the credit", async () => {
    await buyer.goto("/buyer/notifications");
    const reply = buyer.getByRole("listitem").filter({ hasText: `Reply on ${orderNumber}` });
    await reply.getByRole("button", { name: "Mark received" }).click();
    await expect(buyer.getByText("Credit recorded.")).toBeVisible();
    await expect(reply).toHaveCount(0);
  });

  expect(buyerErrors, "uncaught errors on the buyer's pages").toEqual([]);
  expect(supplierErrors, "uncaught errors on the supplier's pages").toEqual([]);
  testInfo.annotations.push({ type: "order", description: orderNumber });
});
