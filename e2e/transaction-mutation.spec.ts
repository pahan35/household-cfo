import { expect, test } from "./fixtures/auth";

test.describe("Transaction Mutation and UI Updates", () => {
  test("creates an expense transaction and verifies it appears in the transactions stream", async ({
    authenticatedPage: page,
  }) => {
    // 1. Visit dashboard first to ensure session and base data load cleanly
    await page.goto("/dashboard/family-budget");
    await expect(page.getByRole("heading", { name: "Accounts & Transactions" })).toBeVisible();

    const uniqueId = `e2e-tx-${Date.now()}`;
    const description = `E2E Automated Grocery Purchase ${Date.now()}`;
    const todayIso = new Date().toISOString().split("T")[0];

    const transactionPayload = {
      id: uniqueId,
      sourceId: "cat-acc-main",
      destinationId: "cat-exp-groceries",
      sourceAmount: 125,
      destinationAmount: 125,
      date: `${todayIso}T12:00:00`,
      description,
    };

    // 2. Post mutation via ExternalProvider API proxy
    const response = await page.request.post("/api/external-provider/api/transaction/create", {
      data: [transactionPayload],
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    // 3. Reload dashboard to fetch fresh transaction state
    await page.reload();
    await expect(page.getByRole("heading", { name: "Accounts & Transactions" })).toBeVisible();

    // 4. Assert the new transaction appears in the transaction stream
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText(/125/)).toBeVisible();
  });
});
