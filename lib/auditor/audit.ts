import { sortFindings, type Finding } from "./findings"
import { intentContext, type IntentContext } from "./intent"
import type { AuditDataset } from "./join"
import { efficiencyIndex, type EfficiencyIndex } from "./efficiency-index"
import { groupRecommendations } from "./recommendations"
import { adRules } from "./rules/ads"
import { campaignRules } from "./rules/campaigns"
import { makeContext, type AuditTargets } from "./rules/context"
import { keywordRules } from "./rules/keywords"
import { analyzeSearchTerms, type SearchTermAnalysis } from "./rules/search-terms"
import {
  analyzeSchedule,
  analyzeSegment,
  type ScheduleAnalysis,
  type SegmentAnalysis,
} from "./rules/segments"

export type { AuditTargets }

export interface AuditResult {
  findings: Finding[]
  /** Areas that could not be assessed and why; missing data is not an account error. */
  notes: string[]
  searchTerms: SearchTermAnalysis | null
  devices: SegmentAnalysis | null
  locations: SegmentAnalysis | null
  schedule: ScheduleAnalysis | null
  index: EfficiencyIndex
  recommendations: ReturnType<typeof groupRecommendations>
}

export const NO_INTENT_CONTEXT: IntentContext = intentContext("", "", "")

/** Runs every rule set. Deterministic: same data and inputs, same findings in the same order. */
export function runAudit(
  data: AuditDataset,
  targets: AuditTargets,
  intent: IntentContext = NO_INTENT_CONTEXT
): AuditResult {
  const ctx = makeContext(data, targets)
  const searchTerms = analyzeSearchTerms(ctx, intent)
  const devices = analyzeSegment(ctx, "device")
  const locations = analyzeSegment(ctx, "location")
  const schedule = analyzeSchedule(ctx)
  const ads = adRules(ctx)
  const parts = [
    campaignRules(ctx),
    keywordRules(ctx),
    searchTerms?.result ?? { findings: [], notes: [] },
    devices?.result ?? { findings: [], notes: [] },
    locations?.result ?? { findings: [], notes: [] },
    schedule?.result ?? { findings: [], notes: [] },
    ads ?? { findings: [], notes: [] },
  ]
  const findings = sortFindings(parts.flatMap((p) => p.findings))
  return {
    findings,
    notes: parts.flatMap((p) => p.notes),
    searchTerms,
    devices,
    locations,
    schedule,
    index: efficiencyIndex({ ctx, findings, searchTerms, devices, locations, ads }),
    recommendations: groupRecommendations(findings),
  }
}
