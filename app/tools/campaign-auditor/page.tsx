import type { Metadata } from "next"
import { CampaignAuditor } from "@/components/tools/campaign-auditor/campaign-auditor"
import { pageUrl } from "@/constants/site"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["campaign-auditor"]

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: pageUrl("/tools/campaign-auditor") },
}

export default function Page() {
  return (
    // --tool tints the icon, header glow and panel edges with this tool's neon hue.
    <div style={{ "--tool": tool.hue } as React.CSSProperties}>
      <CampaignAuditor />
    </div>
  )
}
