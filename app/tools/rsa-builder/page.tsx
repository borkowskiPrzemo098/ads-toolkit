import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { RsaBuilder } from "@/components/tools/rsa-builder/rsa-builder"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["rsa-builder"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return (
    <>
      <RecordVisit slug="rsa-builder" />
      <RsaBuilder />
    </>
  )
}
