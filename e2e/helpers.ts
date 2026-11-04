import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Demo accounts from supabase/mock-data.sql. Seaside Kopitiam is the test buyer because nobody demos
 * with it, so a test order never lands in a demo cart. Override them for other environments.
 */
export const PASSWORD = process.env.E2E_PASSWORD ?? "Tradelink-demo-2026";
export const BUYER_EMAIL = process.env.E2E_BUYER_EMAIL ?? "arif@seaside.example";
export const SUPPLIER_EMAIL = process.env.E2E_SUPPLIER_EMAIL ?? "ravi@islandspice.example";

/** The product the flow orders: cheap, always in stock at Island Spice Traders. */
export const TEST_PRODUCT = process.env.E2E_PRODUCT ?? "Coconut milk 400ml";

/** Marks every record a test writes, so it is easy to find in the shared database. */
export const TEST_NOTE = "End-to-end test, please ignore";

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** A signed-in page in its own browser context, so a buyer and a supplier can work side by side. */
export async function pageFor(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

/** Fails the test if the page shows the app's error screen or logs an uncaught error. */
export function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
