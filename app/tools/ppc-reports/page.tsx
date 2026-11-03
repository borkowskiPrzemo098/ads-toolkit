import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { PpcReports } from "@/components/tools/ppc-reports/ppc-reports"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["ppc-reports"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="ppc-reports" />
      <PpcReports />
    </>
  )
}
