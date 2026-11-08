import { validateServerEnv } from "./src/config/env.server.ts";

/**
 * Build-time security & environment validation:
 * Validates complete server environment and ensures guards (blast-radius, auth bypass,
 * production secret lengths, and adapter modes) fail closed during next build.
 * @param {Record<string, string | undefined>} [env=process.env]
 */
export function validateNextConfigAuth(env = process.env) {
  validateServerEnv(env);
}

validateNextConfigAuth();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    root: import.meta.dirname,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
      {
        source: "/auth/v1/:path*",
        destination: "/auth/login",
        permanent: false,
      },
      {
        source: "/auth/v2/:path*",
        destination: "/auth/login",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
