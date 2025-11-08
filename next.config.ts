import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true, // Use true for a 308 permanent redirect, false for a 307 temporary redirect
      },
    ];
  },
  reactCompiler: true,
};

export default nextConfig;
