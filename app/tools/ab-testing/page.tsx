import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { AbTesting } from "@/components/tools/ab-testing/ab-testing"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["ab-testing"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="ab-testing" />
      <AbTesting />
    </>
  )
}
