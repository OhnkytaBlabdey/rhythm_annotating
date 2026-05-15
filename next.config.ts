import type { NextConfig } from "next";

const isDesktopBuild = process.env.BUILD_TARGET === "desktop";
const basePath = isDesktopBuild ? "" : "/rhythm_annotating";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  ...(process.env.NODE_ENV === "development" && basePath
    ? {
        async redirects() {
          return [
            {
              source: "/",
              destination: basePath,
              basePath: false as const,
              permanent: false,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
