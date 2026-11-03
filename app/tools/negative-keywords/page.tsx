import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { NegativeKeywords } from "@/components/tools/negative-keywords/negative-keywords"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["negative-keywords"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="negative-keywords" />
      <NegativeKeywords />
    </>
  )
}
