import type { Metadata } from "next"
import { ToolPlaceholder } from "@/components/layout/tool-placeholder"
import { TOOL_BY_SLUG } from "@/constants/tools"

const tool = TOOL_BY_SLUG["utm-builder"]

export const metadata: Metadata = { title: tool.name, description: tool.description }

export default function Page() {
  return <ToolPlaceholder slug="utm-builder" />
}
