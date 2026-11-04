import { sortFindings, type Finding } from "./findings"
import type { AuditDataset } from "./join"
import { campaignRules } from "./rules/campaigns"
import { makeContext, type AuditTargets } from "./rules/context"
import { keywordRules } from "./rules/keywords"

export type { AuditTargets }

export interface AuditResult {
  findings: Finding[]
  /** Areas that could not be assessed and why; missing data is not an account error. */
  notes: string[]
}

/** Runs every rule set. Deterministic: same data and targets, same findings in the same order. */
export function runAudit(data: AuditDataset, targets: AuditTargets): AuditResult {
  const ctx = makeContext(data, targets)
  const parts = [campaignRules(ctx), keywordRules(ctx)]
  return {
    findings: sortFindings(parts.flatMap((p) => p.findings)),
    notes: parts.flatMap((p) => p.notes),
  }
}
