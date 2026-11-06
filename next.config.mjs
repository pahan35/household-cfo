/**
 * Build-time security validation:
 * Ensures AUTH_BYPASS_LOCAL cannot be enabled when deploying or building on Vercel.
 * @param {Record<string, string | undefined>} [env=process.env]
 */
export function validateNextConfigAuth(env = process.env) {
  const isVercel = env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
  if (isVercel && env.AUTH_BYPASS_LOCAL?.toLowerCase() === "true") {
    throw new Error("FATAL BUILD ERROR: AUTH_BYPASS_LOCAL cannot be set to 'true' in a Vercel environment.");
  }
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
