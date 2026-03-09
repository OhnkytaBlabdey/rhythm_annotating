import type { NextConfig } from "next";

const basePath = "/rhythm_annotating";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
