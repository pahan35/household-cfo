import { expect, test } from "./fixtures/auth";

test.describe("Authentication and Route Protection", () => {
  test("unauthenticated access to /dashboard/family-budget redirects to /auth/login with returnTo", async ({
    page,
  }) => {
    // Navigate directly without auth cookies
    await page.goto("/dashboard/family-budget");

    // Expect redirect to login page with returnTo parameter
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(page.url()).toContain("returnTo=");

    // Verify login card elements
    await expect(page.getByRole("heading", { name: "Family Budget" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in with Google/i })).toBeVisible();
  });

  test("authenticated session accesses /dashboard/family-budget without redirection", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/family-budget");

    // Expect to remain on the family budget dashboard
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/family-budget/);

    // Verify main dashboard heading is rendered
    await expect(authenticatedPage.getByRole("heading", { name: "Accounts & Transactions" })).toBeVisible();
  });
});
