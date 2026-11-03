import type { Metadata } from "next"
import { RecordVisit } from "@/components/layout/record-visit"
import { BudgetPlanner } from "@/components/tools/budget-planner/budget-planner"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { pageUrl } from "@/constants/site"

const tool = TOOL_BY_SLUG["budget-planner"]

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: pageUrl("/tools/budget-planner") },
}

export default function Page() {
  return (
    <>
      <RecordVisit slug="budget-planner" />
      <BudgetPlanner />
    </>
  )
}
