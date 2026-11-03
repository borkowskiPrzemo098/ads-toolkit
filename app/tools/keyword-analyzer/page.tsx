import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { KeywordAnalyzer } from "@/components/tools/keyword-analyzer/keyword-analyzer"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { pageUrl } from "@/constants/site"

const tool = TOOL_BY_SLUG["keyword-analyzer"]

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: pageUrl("/tools/keyword-analyzer") },
}

export default function Page() {
  return (
    // --tool tints the icon, header glow and panel edges with this tool's neon hue.
    <div style={{ "--tool": tool.hue } as React.CSSProperties}>
      <RecordVisit slug="keyword-analyzer" />
      <KeywordAnalyzer />
    </div>
  )
}
