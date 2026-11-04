import { formatNumber } from "@/lib/formatting/number"
import { REPORT_TYPES, type ReportType } from "./detect"
import type { ImportIssue } from "./import"
import { addInto, emptyMetrics, relativeDiff, sumMetrics, type Metrics } from "./metrics"
import { nameKey, type NormalizedRecord, type NormalizedReport } from "./normalize"

/*
 * Joins normalised reports into one dataset without double counting:
 * - account totals come from ONE report, the highest level available (campaign > ad group > …);
 * - detailed reports are attached to campaigns and ad groups for root-cause analysis, never added;
 * - campaigns join by Campaign ID; names are a fallback, and a name that maps to one ID in any
 *   report borrows that ID, so ID-less reports still land on the right campaign.
 */

export type JoinMethod = "id" | "name→id" | "name" | "none"

export interface CampaignEntity {
  key: string
  id?: string
  name: string
  type?: string
  status?: string
  /** Report ids this campaign appears in. */
  reports: string[]
  /** Metrics of this campaign in the totals report (null when it is absent there). */
  primary: Metrics | null
}

export interface AdGroupEntity {
  key: string
  campaignKey: string | null
  id?: string
  name: string
  reports: string[]
}

export interface ReportJoin {
  reportId: string
  campaign: Record<JoinMethod, number>
  /** Campaigns in this report that the totals report does not have. */
  unmatchedCampaigns: string[]
}

export type CheckStatus =
  "source" | "match" | "lower" | "higher" | "other-period" | "no-metrics"

export interface ReconciliationRow {
  reportId: string
  name: string
  type: ReportType
  metrics: Metrics
  status: CheckStatus
  /** Relative difference per metric against the totals report (0.02 = 2% more). */
  diff: Partial<Record<"cost" | "clicks" | "conversions", number | null>>
  note: string
}

export interface AuditDataset {
  reports: NormalizedReport[]
  /** Report the account totals come from. */
  primary: NormalizedReport | null
  totals: Metrics
  /** Shared currency of the reports; null when no report says (amounts shown without a symbol). */
  currency: string | null
  period: NormalizedReport["period"]
  campaigns: CampaignEntity[]
  adGroups: AdGroupEntity[]
  joins: ReportJoin[]
  checks: ReconciliationRow[]
  issues: ImportIssue[]
  /** Campaign key of every record, by report id, aligned with report.records. */
  campaignKeyOf: Map<string, (string | null)[]>
  adGroupKeyOf: Map<string, (string | null)[]>
}

/** Differences up to 1% are rounding in exported values (two decimals per row). */
export const MATCH_TOLERANCE = 0.01

const samePeriod = (a: NormalizedReport["period"], b: NormalizedReport["period"]) =>
  !a || !b || (a.from === b.from && a.to === b.to)

const days = (p: NonNullable<NormalizedReport["period"]>) =>
  Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1

/** Highest level first; among equals, the longest period, then the most records. */
export function pickPrimary(reports: NormalizedReport[]): NormalizedReport | null {
  const withSpend = reports.filter((r) => r.records.some((x) => x.metrics.cost !== null))
  return (
    [...withSpend].sort(
      (a, b) =>
        REPORT_TYPES[a.type].level - REPORT_TYPES[b.type].level ||
        (b.period ? days(b.period) : 0) - (a.period ? days(a.period) : 0) ||
        b.records.length - a.records.length
    )[0] ?? null
  )
}

export function buildDataset(reports: NormalizedReport[]): AuditDataset {
  const issues: ImportIssue[] = []
  const primary = pickPrimary(reports)

  // 1. Names that map to exactly one Campaign ID anywhere in the audit.
  const idsByName = new Map<string, Set<string>>()
  for (const r of reports)
    for (const { dims } of r.records)
      if (dims.campaign && dims.campaignId) {
        const k = nameKey(dims.campaign)
        idsByName.set(k, (idsByName.get(k) ?? new Set()).add(dims.campaignId))
      }
  const ambiguous = [...idsByName].filter(([, ids]) => ids.size > 1).map(([n]) => n)
  if (ambiguous.length)
    issues.push({
      severity: "warning",
      message: `${ambiguous.length} ${ambiguous.length === 1 ? "nazwa kampanii ma" : "nazwy kampanii mają"} kilka różnych identyfikatorów (np. „${ambiguous[0]}”). Raporty bez identyfikatorów nie zostaną do nich przypisane po nazwie.`,
    })

  const campaigns = new Map<string, CampaignEntity>()
  const adGroups = new Map<string, AdGroupEntity>()
  const joins: ReportJoin[] = []
  const campaignKeyOf = new Map<string, (string | null)[]>()
  const adGroupKeyOf = new Map<string, (string | null)[]>()

  const campaignKey = (rec: NormalizedRecord): [string | null, JoinMethod] => {
    const { campaignId, campaign } = rec.dims
    if (campaignId) return [`id:${campaignId}`, "id"]
    if (!campaign) return [null, "none"]
    const ids = idsByName.get(nameKey(campaign))
    if (ids?.size === 1) return [`id:${[...ids][0]}`, "name→id"]
    return [`name:${nameKey(campaign)}`, "name"]
  }

  for (const report of reports) {
    const join: ReportJoin = {
      reportId: report.id,
      campaign: { id: 0, "name→id": 0, name: 0, none: 0 },
      unmatchedCampaigns: [],
    }
    const cKeys: (string | null)[] = []
    const gKeys: (string | null)[] = []
    for (const rec of report.records) {
      const [ck, method] = campaignKey(rec)
      join.campaign[method]++
      cKeys.push(ck)
      if (ck) {
        const entity = campaigns.get(ck) ?? {
          key: ck,
          id: ck.startsWith("id:") ? ck.slice(3) : undefined,
          name: rec.dims.campaign ?? `ID ${ck.slice(3)}`,
          reports: [],
          primary: null,
        }
        if (rec.dims.campaign && entity.name.startsWith("ID "))
          entity.name = rec.dims.campaign
        entity.type ??= rec.dims.campaignType
        entity.status ??= rec.dims.campaignStatus
        if (!entity.reports.includes(report.id)) entity.reports.push(report.id)
        if (report === primary)
          entity.primary = addInto(entity.primary ?? emptyMetrics(), rec.metrics)
        campaigns.set(ck, entity)
      }
      const { adGroupId, adGroup } = rec.dims
      const gk = adGroupId
        ? `id:${adGroupId}`
        : adGroup
          ? `${ck ?? "?"}|${nameKey(adGroup)}`
          : null
      gKeys.push(gk)
      if (gk) {
        const g = adGroups.get(gk) ?? {
          key: gk,
          campaignKey: ck,
          id: adGroupId,
          name: adGroup ?? `ID ${adGroupId}`,
          reports: [],
        }
        if (adGroup && g.name.startsWith("ID ")) g.name = adGroup
        if (!g.reports.includes(report.id)) g.reports.push(report.id)
        adGroups.set(gk, g)
      }
    }
    campaignKeyOf.set(report.id, cKeys)
    adGroupKeyOf.set(report.id, gKeys)
    joins.push(join)
  }

  // 2. Campaigns that detailed reports mention but the totals report does not.
  const primaryHasCampaigns = primary?.records.some(
    (r) => r.dims.campaign || r.dims.campaignId
  )
  if (primary && primaryHasCampaigns) {
    for (const join of joins) {
      if (join.reportId === primary.id) continue
      const keys = new Set(campaignKeyOf.get(join.reportId)!.filter(Boolean) as string[])
      join.unmatchedCampaigns = [...keys]
        .filter((k) => !campaigns.get(k)!.reports.includes(primary.id))
        .map((k) => campaigns.get(k)!.name)
      if (join.unmatchedCampaigns.length) {
        const report = reports.find((r) => r.id === join.reportId)!
        issues.push({
          severity: "warning",
          message: `Raport „${report.name}” zawiera ${join.unmatchedCampaigns.length} ${join.unmatchedCampaigns.length === 1 ? "kampanię" : "kampanii"} spoza raportu „${primary.name}” (${join.unmatchedCampaigns.slice(0, 3).join(", ")}). Sprawdź, czy oba raporty dotyczą tego samego konta i okresu.`,
        })
      }
    }
  }

  // 3. Different accounts in one audit.
  const customers = new Set(
    reports.flatMap((r) => r.records.map((x) => x.dims.customerId).filter(Boolean))
  )
  if (customers.size > 1)
    issues.push({
      severity: "warning",
      message: `Raporty pochodzą z ${customers.size} różnych kont (identyfikatory klienta: ${[...customers].slice(0, 3).join(", ")}). Sumy konta mogą mieszać dane klientów.`,
    })

  // 4. One currency for the whole audit.
  const currencies = [
    ...new Set(reports.map((r) => r.currency).filter(Boolean)),
  ] as string[]
  if (currencies.length > 1)
    issues.push({
      severity: "warning",
      message: `Raporty są w różnych walutach (${currencies.join(", ")}). Kwoty z różnych walut nie są przeliczane.`,
    })

  // 5. Reconciliation of every report against the totals.
  const totals = primary
    ? sumMetrics(primary.records.map((r) => r.metrics))
    : emptyMetrics()
  const checks = reports.map((report) => {
    // A report limited to some campaigns is compared with those campaigns' totals, so
    // "37% of the account" can still be "exactly matching where it applies".
    let scope: Scope | undefined
    if (primary && primaryHasCampaigns && report !== primary) {
      const keys = campaignKeyOf.get(report.id)!
      const covered = new Set(keys)
      const entities = [...covered].map((k) => (k ? campaigns.get(k) : undefined))
      if (entities.every((e) => e?.primary))
        scope = {
          base: sumMetrics(entities.map((e) => e!.primary!)),
          covered: covered.size,
          total: [...campaigns.values()].filter((c) => c.primary).length,
        }
    }
    return reconcile(report, primary, totals, scope)
  })
  for (const c of checks)
    if (c.status === "higher")
      issues.push({ severity: "warning", message: `„${c.name}”: ${c.note}` })

  const unrecognised = reports.flatMap((r) =>
    r.unrecognised.map((u) => ({ ...u, report: r.name }))
  )
  if (unrecognised.length)
    issues.push({
      severity: "info",
      message: `Nierozpoznane wartości (pozostawione bez kategorii): ${unrecognised
        .slice(0, 4)
        .map((u) => `„${u.value}” w ${u.report}`)
        .join(", ")}.`,
    })

  return {
    reports,
    primary,
    totals,
    currency: primary?.currency ?? (currencies.length === 1 ? currencies[0] : null),
    period: primary?.period ?? null,
    campaigns: [...campaigns.values()].sort(
      (a, b) =>
        (b.primary?.cost ?? -1) - (a.primary?.cost ?? -1) ||
        a.name.localeCompare(b.name, "pl")
    ),
    adGroups: [...adGroups.values()],
    joins,
    checks,
    issues,
    campaignKeyOf,
    adGroupKeyOf,
  }
}

const pct = (v: number) => `${formatNumber(Math.abs(v) * 100, 1)}%`

/** Why a detailed report can legitimately sum lower than the account. */
const LOWER_REASON: Partial<Record<ReportType, string>> = {
  searchTerm:
    "Google Ads pokazuje tylko hasła wyszukiwane przez wystarczająco wiele osób, więc raport haseł zwykle nie obejmuje całego kosztu.",
  keyword:
    "Kampanie bez słów kluczowych (np. Performance Max, Display) nie mają wierszy w raporcie słów kluczowych.",
  ad: "Raport może nie obejmować wszystkich typów reklam lub kampanii.",
  landingPage:
    "Część ruchu (np. Performance Max) może nie mieć przypisanej strony docelowej.",
  location:
    "Raport lokalizacji obejmuje tylko wybrany poziom (np. miasta), bez ruchu nieprzypisanego.",
}

interface Scope {
  /** Totals-report metrics of the campaigns this report covers. */
  base: Metrics
  covered: number
  total: number
}

function reconcile(
  report: NormalizedReport,
  primary: NormalizedReport | null,
  totals: Metrics,
  scope?: Scope
): ReconciliationRow {
  const metrics = sumMetrics(report.records.map((r) => r.metrics))
  const base = {
    reportId: report.id,
    name: report.name,
    type: report.type,
    metrics,
    diff: {},
  }
  if (!primary) return { ...base, status: "no-metrics", note: "Brak raportu z kosztem." }
  if (report === primary)
    return {
      ...base,
      status: "source",
      note: "Źródło sum konta. Pozostałe raporty są porównywane z tym raportem.",
    }
  if (!samePeriod(report.period, primary.period))
    return {
      ...base,
      status: "other-period",
      note: "Inny okres niż raport z sumami konta: sumy nie są porównywane.",
    }

  const diff = {
    cost: relativeDiff(totals.cost, metrics.cost),
    clicks: relativeDiff(totals.clicks, metrics.clicks),
    conversions: relativeDiff(totals.conversions, metrics.conversions),
  }
  const ref = scope && scope.covered < scope.total ? scope.base : totals
  const where =
    scope && scope.covered < scope.total
      ? `Obejmuje ${scope.covered} z ${scope.total} kampanii; w nich `
      : ""
  const known = (["cost", "clicks", "conversions"] as const)
    .map((m) => relativeDiff(ref[m], metrics[m]))
    .filter((d): d is number => d !== null)
  if (!known.length)
    return {
      ...base,
      diff,
      status: "no-metrics",
      note: "Brak kosztu, kliknięć i konwersji do porównania.",
    }

  const worst = known.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
  if (Math.abs(worst) <= MATCH_TOLERANCE)
    return {
      ...base,
      diff,
      status: "match",
      note: where
        ? `${where}sumy zgodne z raportem nadrzędnym (różnica do 1%).`
        : "Sumy zgodne z raportem nadrzędnym (różnica do 1%).",
    }
  if (known.some((d) => d > MATCH_TOLERANCE))
    return {
      ...base,
      diff,
      status: "higher",
      note: `${where ? `${where}suma` : "Suma"} jest wyższa niż w raporcie „${primary.name}” (o ${pct(Math.max(...known))}). Raport szczegółowy nie powinien przekraczać sum konta: możliwe zdublowane wiersze, inne konto lub inny zakres.`,
    }
  return {
    ...base,
    diff,
    status: "lower",
    note: `${where ? `${where}jest` : "Obejmuje"} ${pct(1 + worst)} wartości z raportu nadrzędnego. ${LOWER_REASON[report.type] ?? "Raport może obejmować tylko część konta."}`,
  }
}
