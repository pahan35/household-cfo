import { describe, expect, it } from "vitest";

import { createE2ESessionToken, DEFAULT_E2E_EMAIL } from "../../../../e2e/fixtures/auth";
import { verifySessionToken } from "../session";

describe("E2E Session Token Generation & Verification", () => {
  const secret = "test-e2e-auth-secret-key-with-sufficient-length-32";
  const env = {
    AUTH_SECRET: secret,
    ALLOWED_USER_EMAILS: `admin@family.org,${DEFAULT_E2E_EMAIL}`,
    NODE_ENV: "production",
    VERCEL: "1",
  };

  it("mints a valid HMAC-SHA256 session token verified by verifySessionToken", async () => {
    const token = await createE2ESessionToken({
      secret,
      email: DEFAULT_E2E_EMAIL,
      name: "E2E Automated Tester",
    });

    const user = await verifySessionToken(token, { secret, env });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(DEFAULT_E2E_EMAIL);
    expect(user?.name).toBe("E2E Automated Tester");
  });

  it("allows custom email if included in ALLOWED_USER_EMAILS", async () => {
    const customEmail = "custom-tester@family-budget.internal";
    const customEnv = {
      ...env,
      ALLOWED_USER_EMAILS: `admin@family.org,${customEmail}`,
    };

    const token = await createE2ESessionToken({
      secret,
      email: customEmail,
    });

    const user = await verifySessionToken(token, { secret, env: customEnv });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(customEmail);
  });

  it("fails verification if user email is not present in ALLOWED_USER_EMAILS", async () => {
    const unallowedEmail = "unauthorized@external.com";
    const token = await createE2ESessionToken({
      secret,
      email: unallowedEmail,
    });

    const user = await verifySessionToken(token, { secret, env });
    expect(user).toBeNull();
  });

  it("fails verification if secret does not match", async () => {
    const token = await createE2ESessionToken({
      secret: "some-other-secret-key-32-chars-long-123456",
      email: DEFAULT_E2E_EMAIL,
    });

    const user = await verifySessionToken(token, { secret, env });
    expect(user).toBeNull();
  });

  it("fails verification when token is expired", async () => {
    const now = 1_000_000;
    const token = await createE2ESessionToken({
      secret,
      email: DEFAULT_E2E_EMAIL,
      now,
      expiresInSeconds: 30,
    });

    const user = await verifySessionToken(token, {
      secret,
      env,
      now: now + 35,
    });
    expect(user).toBeNull();
  });
});
