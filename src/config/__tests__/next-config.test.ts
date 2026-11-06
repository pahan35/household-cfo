import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config.mjs";

describe("next.config headers", () => {
  it("defines global X-Robots-Tag header for all routes", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) {
      throw new Error("headers() is not defined on nextConfig");
    }
    const headersConfig = await nextConfig.headers();
    const globalHeader = headersConfig.find((item: { source: string }) => item.source === "/:path*");
    expect(globalHeader).toBeDefined();
    expect(globalHeader?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
    });
  });
});
