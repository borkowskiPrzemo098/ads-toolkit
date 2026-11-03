import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { NegativeKeywords } from "@/components/tools/negative-keywords/negative-keywords"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { pageUrl } from "@/constants/site"

const tool = TOOL_BY_SLUG["negative-keywords"]

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: pageUrl("/tools/negative-keywords") },
}

export default function Page() {
  return (
    // --tool tints the icon, header glow and panel edges with this tool's neon hue.
    <div style={{ "--tool": tool.hue } as React.CSSProperties}>
      <RecordVisit slug="negative-keywords" />
      <NegativeKeywords />
    </div>
  )
}
