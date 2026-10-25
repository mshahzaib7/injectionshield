import type { NextConfig } from "next";

// Fully static export: no server, no API routes. All inference runs in the browser.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
