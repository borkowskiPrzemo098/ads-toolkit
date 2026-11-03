import type { NextConfig } from "next"

/**
 * Static export for GitHub Pages. The site lives under /<repo>, so builds for Pages set
 * PAGES_BASE_PATH=/ads-toolkit (see .github/workflows/pages.yml). Local builds and the E2E
 * suite run at the root.
 */
const basePath = process.env.PAGES_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // tools/profitability/index.html: every static host serves folders without rewrites.
  trailingSlash: true,
  env: {
    // Read by code that builds asset URLs by hand (PDF fonts).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // No Cache Components / PPR: export mode rejects them, and every route is static anyway.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
