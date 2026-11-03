import type { MetadataRoute } from "next"
import { INFO_PAGES, pageUrl } from "@/constants/site"
import { TOOLS, toolHref } from "@/constants/tools"

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    ...TOOLS.map((t) => toolHref(t.slug)),
    ...INFO_PAGES.map((p) => p.href),
  ]
  return paths.map((path) => ({
    url: pageUrl(path),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.startsWith("/tools/") ? 0.8 : 0.3,
  }))
}
