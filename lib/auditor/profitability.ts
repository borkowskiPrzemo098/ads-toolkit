import { calcFail, calcOk, type CalcResult } from "@/types/calculation"
import type { AuditDataset } from "./join"
import type { Metrics } from "./metrics"

/*
 * Profitability (spec section 6). Three kinds of numbers, always labelled:
 * - "google": straight from the imported reports (cost, conversions, conversion value);
 * - "manual": typed by the user (margin, product, delivery and other costs, target);
 * - "estimate": computed from both (profit, break-even ROAS, max CPA…).
 * Without a margin or product cost there is no profit: the reason is shown instead.
 */

export type Origin = "google" | "manual" | "estimate"

export const ORIGIN_LABEL: Record<Origin, string> = {
  google: "Google Ads",
  manual: "Wpisane",
  estimate: "Szacunek",
}

export interface ProfitInputs {
  /** Average order value; used only when the reports have no conversion value. */
  aov: number | null
  /** Gross margin in percent of revenue (30 = 30%). */
  marginPct: number | null
  /** Product cost per order; an alternative to the margin. */
  productCost: number | null
  shippingCost: number | null
  otherCost: number | null
  /** Profit the user wants from the period, after ad cost. */
  targetProfit: number | null
}

export const NO_PROFIT_INPUTS: ProfitInputs = {
  aov: null,
  marginPct: null,
  productCost: null,
  shippingCost: null,
  otherCost: null,
  targetProfit: null,
}

export interface Line {
  label: string
  value: CalcResult
  origin: Origin
  kind: "money" | "percent" | "number"
  hint?: string
}

export interface ProfitRow {
  name: string
  revenue: CalcResult
  profit: CalcResult
  roas: CalcResult
}

export interface ProfitModel {
  lines: Line[]
  /** Per campaign from the totals report (same assumptions). */
  campaigns: ProfitRow[]
  /** True when profit could be estimated. */
  ready: boolean
  missing: string[]
}

interface Core {
  revenue: CalcResult
  revenueOrigin: Origin
  orders: number
  /** Contribution before ad cost: revenue × margin − delivery and other costs per order. */
  contribution: CalcResult
}

/** Revenue and contribution for any metrics block, with the same inputs. */
function core(m: Metrics, i: ProfitInputs): Core {
  const orders = m.conversions ?? 0
  let revenue: CalcResult
  let revenueOrigin: Origin = "google"
  // Zero value with zero orders is a real 0; zero value with orders means value is not tracked.
  if (m.conversionValue !== null && (m.conversionValue > 0 || orders === 0))
    revenue = calcOk(m.conversionValue)
  else if (i.aov !== null) {
    revenue = calcOk(orders * i.aov)
    revenueOrigin = "estimate"
  } else
    revenue = calcFail(
      "Raporty nie mają wartości konwersji: wpisz średnią wartość zamówienia."
    )

  let contribution: CalcResult
  if (!revenue.ok) contribution = revenue
  else if (i.marginPct === null && i.productCost === null)
    contribution = calcFail("Wpisz marżę albo koszt produktu, aby oszacować zysk.")
  else {
    const gross =
      i.marginPct !== null
        ? revenue.value * (i.marginPct / 100)
        : revenue.value - orders * i.productCost!
    contribution = calcOk(gross - orders * ((i.shippingCost ?? 0) + (i.otherCost ?? 0)))
  }
  return { revenue, revenueOrigin, orders, contribution }
}

export function profitModel(data: AuditDataset, i: ProfitInputs): ProfitModel {
  const t = data.totals
  const adCost = t.cost
  const c = core(t, i)
  const missing: string[] = []
  if (!c.revenue.ok) missing.push(c.revenue.reason)
  if (c.revenue.ok && !c.contribution.ok) missing.push(c.contribution.reason)

  const need = (r: CalcResult, f: (v: number) => CalcResult): CalcResult =>
    r.ok ? f(r.value) : r
  const revenueRatio = need(c.contribution, (contrib) =>
    c.revenue.ok && c.revenue.value > 0
      ? calcOk(contrib / c.revenue.value)
      : calcFail("Brak przychodu.")
  )
  const profit = need(c.contribution, (contrib) =>
    adCost === null ? calcFail("Brak kosztu reklamy.") : calcOk(contrib - adCost)
  )
  const breakEven = need(revenueRatio, (ratio) =>
    ratio > 0
      ? calcOk(100 / ratio)
      : calcFail(
          "Koszty zmienne przekraczają marżę: sprzedaż nie pokrywa kosztów nawet bez reklamy."
        )
  )
  const maxCpa = need(c.contribution, (contrib) =>
    c.orders > 0 ? calcOk(contrib / c.orders) : calcFail("Brak konwersji.")
  )
  const roas =
    adCost && c.revenue.ok
      ? calcOk((c.revenue.value / adCost) * 100)
      : calcFail("Brak kosztu lub przychodu.")
  const profitability = need(profit, (p) =>
    c.revenue.ok && c.revenue.value > 0
      ? calcOk((p / c.revenue.value) * 100)
      : calcFail("Brak przychodu.")
  )
  const targetRoas =
    i.targetProfit === null
      ? null
      : need(revenueRatio, (ratio) =>
          adCost && ratio > 0
            ? calcOk(((adCost + i.targetProfit!) / adCost / ratio) * 100)
            : calcFail("Brak kosztu reklamy.")
        )

  const lines: Line[] = [
    {
      label: "Koszt reklamy",
      value: adCost === null ? calcFail("Brak kosztu w raportach.") : calcOk(adCost),
      origin: "google",
      kind: "money",
    },
    {
      label: "Konwersje (zamówienia)",
      value: calcOk(c.orders),
      origin: "google",
      kind: "number",
    },
    {
      label:
        c.revenueOrigin === "google"
          ? "Przychód (wartość konwersji)"
          : "Szacowany przychód",
      value: c.revenue,
      origin: c.revenueOrigin,
      kind: "money",
      hint:
        c.revenueOrigin === "estimate"
          ? "konwersje × średnia wartość zamówienia"
          : undefined,
    },
    {
      label: "ROAS",
      value: roas,
      origin: c.revenueOrigin === "google" ? "google" : "estimate",
      kind: "percent",
      hint: "przychód ÷ koszt reklamy; to nie jest zysk",
    },
    {
      label: "Szacowana marża po kosztach zmiennych",
      value: c.contribution,
      origin: "estimate",
      kind: "money",
      hint:
        i.marginPct !== null
          ? "przychód × marża − (dostawa + inne) × zamówienia"
          : "przychód − (koszt produktu + dostawa + inne) × zamówienia",
    },
    {
      label: "Szacowany zysk po reklamie",
      value: profit,
      origin: "estimate",
      kind: "money",
      hint: "marża po kosztach zmiennych − koszt reklamy",
    },
    {
      label: "Szacowana rentowność",
      value: profitability,
      origin: "estimate",
      kind: "percent",
      hint: "zysk ÷ przychód",
    },
    {
      label: "Break-even ROAS",
      value: breakEven,
      origin: "estimate",
      kind: "percent",
      hint: "ROAS, przy którym zysk = 0",
    },
    {
      label: "Maksymalny opłacalny CPA",
      value: maxCpa,
      origin: "estimate",
      kind: "money",
      hint: "marża po kosztach zmiennych na zamówienie",
    },
  ]
  // Typed values, shown next to the data they change.
  const manual: [string, number | null, Line["kind"]][] = [
    ["Marża (wpisana)", i.marginPct, "percent"],
    ["Koszt produktu na zamówienie", i.productCost, "money"],
    ["Koszt dostawy na zamówienie", i.shippingCost, "money"],
    ["Inne koszty zmienne na zamówienie", i.otherCost, "money"],
    [
      "Średnia wartość zamówienia (wpisana)",
      c.revenueOrigin === "estimate" ? i.aov : null,
      "money",
    ],
    ["Docelowy zysk", i.targetProfit, "money"],
  ]
  lines.splice(
    3,
    0,
    ...manual
      .filter(([, value]) => value !== null)
      .map(([label, value, kind]) => ({
        label,
        value: calcOk(value!),
        origin: "manual" as const,
        kind,
      }))
  )
  if (targetRoas)
    lines.push({
      label: "ROAS potrzebny do docelowego zysku",
      value: targetRoas,
      origin: "estimate",
      kind: "percent",
      hint: "przy obecnym koszcie reklamy",
    })

  const campaigns: ProfitRow[] = data.campaigns
    .filter((x) => x.primary && (x.primary.cost ?? 0) > 0)
    .map((x) => {
      const cc = core(x.primary!, i)
      const cost = x.primary!.cost ?? 0
      return {
        name: x.name,
        revenue: cc.revenue,
        profit: cc.contribution.ok
          ? calcOk(cc.contribution.value - cost)
          : cc.contribution,
        roas:
          cc.revenue.ok && cost
            ? calcOk((cc.revenue.value / cost) * 100)
            : calcFail("Brak przychodu."),
      }
    })

  return { lines, campaigns, ready: profit.ok, missing }
}
