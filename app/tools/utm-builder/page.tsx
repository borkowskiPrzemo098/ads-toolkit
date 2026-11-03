import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { UtmBuilder } from "@/components/tools/utm-builder/utm-builder"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { pageUrl } from "@/constants/site"

const tool = TOOL_BY_SLUG["utm-builder"]

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: pageUrl("/tools/utm-builder") },
}

export default function Page() {
  return (
    // --tool tints the icon, header glow and panel edges with this tool's neon hue.
    <div style={{ "--tool": tool.hue } as React.CSSProperties}>
      <RecordVisit slug="utm-builder" />
      <UtmBuilder />
    </div>
  )
}
