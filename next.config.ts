import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath: "/note_beat_sampling",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
