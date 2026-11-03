import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { UtmBuilder } from "@/components/tools/utm-builder/utm-builder"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["utm-builder"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="utm-builder" />
      <UtmBuilder />
    </>
  )
}
