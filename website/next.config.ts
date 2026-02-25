import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname),
};

export default nextConfig;
