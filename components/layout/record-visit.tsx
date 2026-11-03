"use client"

import { useEffect } from "react"
import { recordToolVisit } from "@/hooks/use-tool-usage"
import type { ToolSlug } from "@/types/tool"

export function RecordVisit({ slug }: { slug: ToolSlug }) {
  useEffect(() => {
    recordToolVisit(slug)
  }, [slug])
  return null
}
