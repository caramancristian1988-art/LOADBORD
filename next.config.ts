import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // NO_REACT_COMPILER=1 works around a Windows-only crash of the compiler's babel worker during `next build`
  reactCompiler: !process.env.NO_REACT_COMPILER,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
