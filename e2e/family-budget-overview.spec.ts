import { expect, test } from "./fixtures/auth";

test.describe("Family Budget Overview & Seed Data Verification", () => {
  test("renders accounts, balances, and seeded categories from deterministic mock seed", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard/family-budget");

    // Wait for the primary dashboard shell to render
    await expect(page.getByRole("heading", { name: "Accounts & Transactions" })).toBeVisible();

    // Verify Accounts & Cards section and Main Account PLN
    await expect(page.getByText("Accounts & Cards")).toBeVisible();
    await expect(page.getByText("Main Account PLN").first()).toBeVisible();

    // Verify seeded expense categories
    await expect(page.getByText("Groceries").first()).toBeVisible();
    await expect(page.getByText("Housing & Utilities").first()).toBeVisible();

    // Verify progress meters (budget meters) are present
    const progressBars = page.getByRole("progressbar");
    await expect(progressBars.first()).toBeVisible();

    // Verify Transactions card is rendered
    await expect(page.getByText("Transactions").first()).toBeVisible();
  });
});
