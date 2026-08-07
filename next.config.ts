import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixture JSONs are read with fs at runtime; make sure serverless bundles include them.
  outputFileTracingIncludes: {
    "/api/context": ["./fixtures/**"],
    "/api/rescue": ["./fixtures/**"],
  },
  async headers() {
    return [
      {
        source: "/duckdb/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
