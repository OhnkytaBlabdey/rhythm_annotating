import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath: "/rhythm_annotating",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
