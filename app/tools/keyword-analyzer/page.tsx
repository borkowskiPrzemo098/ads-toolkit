import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { KeywordAnalyzer } from "@/components/tools/keyword-analyzer/keyword-analyzer"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["keyword-analyzer"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="keyword-analyzer" />
      <KeywordAnalyzer />
    </>
  )
}
