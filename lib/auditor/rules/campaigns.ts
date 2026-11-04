import { confidenceOf, type Finding } from "../findings"
import type { CampaignEntity } from "../join"
import { addInto, emptyMetrics, kpisOf, type Metrics } from "../metrics"
import { clicksToJudge, median, pHigher, pLower } from "../stats"
import { T } from "../thresholds"
import { baselineOf, n0, n1, pct, periodOf, share, type RuleContext } from "./context"

/*
 * Campaign rules (spec 5A). Input: campaign metrics from the account-totals report only,
 * so shares add up to 100% and nothing is counted twice.
 */

interface Item {
  c: CampaignEntity
  m: Metrics
  costShare: number
  convShare: number | null
  cpa: number | null
  cr: number | null
  ctr: number | null
  roas: number | null
}

export interface RuleResult {
  findings: Finding[]
  /** Why an area could not be assessed (missing report or columns). */
  notes: string[]
}

export function campaignRules(ctx: RuleContext): RuleResult {
  const { data, targets, money } = ctx
  const primary = data.primary
  const withMetrics = data.campaigns.filter((c) => c.primary)
  if (!primary || !withMetrics.length)
    return {
      findings: [],
      notes: [
        "Analiza kampanii wymaga raportu z kolumną „Kampania” i kosztem (najlepiej raportu kampanii).",
      ],
    }

  const base = baselineOf(data.totals)
  const totalCost = data.totals.cost ?? 0
  const totalConv = data.totals.conversions ?? 0
  const source = (method: string) => ({
    report: primary.name,
    dimension: "Kampania",
    period: periodOf(primary),
    method,
  })
  const findings: Finding[] = []
  const notes: string[] = []
  if (!base.cr || !base.cpa)
    notes.push(
      "Konto nie ma konwersji w raporcie, więc reguły oparte na CPA i współczynniku konwersji zostały pominięte."
    )

  const items: Item[] = withMetrics.map((c) => {
    const m = c.primary!
    const k = kpisOf(m)
    return {
      c,
      m,
      costShare: totalCost ? (m.cost ?? 0) / totalCost : 0,
      convShare: totalConv ? (m.conversions ?? 0) / totalConv : null,
      cpa: k.cpa.ok ? k.cpa.value : null,
      cr: k.conversionRate.ok ? k.conversionRate.value / 100 : null,
      ctr: k.ctr.ok ? k.ctr.value / 100 : null,
      roas: k.roas.ok ? k.roas.value : null,
    }
  })
  const flagged = new Set<string>()
  const ev = (it: Item) => [
    { label: "Koszt", value: `${money(it.m.cost ?? 0)} (${share(it.costShare)} konta)` },
    { label: "Kliknięcia", value: n0(it.m.clicks) },
    {
      label: "Konwersje",
      value: `${n1(it.m.conversions)}${it.convShare !== null ? ` (${share(it.convShare)} konta)` : ""}`,
    },
    {
      label: "CPA",
      value:
        it.cpa === null
          ? "N/D (brak konwersji)"
          : `${money(it.cpa)} (konto: ${base.cpa ? money(base.cpa) : "N/D"})`,
    },
  ]
  const cpaLimit = targets.cpa
    ? targets.cpa * 1.2
    : base.cpa
      ? base.cpa * T.highCpaRatio
      : null

  for (const it of items) {
    const clicks = it.m.clicks ?? 0
    const conv = it.m.conversions ?? 0
    const cost = it.m.cost ?? 0
    if (!base.cr || !base.cpa || !clicks || !cost) continue
    // Conversion rate this campaign would need to reach the benchmark CPA at its own CPC.
    const neededRate = Math.min(0.999, cost / ((targets.cpa ?? base.cpa) * clicks))
    const p = pLower(conv, clicks, neededRate)
    const valueOk = it.roas !== null && base.roas !== null && it.roas >= base.roas

    // A1: big spend, little return.
    if (
      it.costShare >= T.highCostShare &&
      it.convShare !== null &&
      it.convShare < it.costShare * T.convShareRatio &&
      p < T.alpha &&
      !valueOk
    ) {
      flagged.add(it.c.key)
      const expected = cost / (targets.cpa ?? base.cpa)
      findings.push({
        id: `A1:${it.c.key}`,
        rule: "A1",
        area: "campaign",
        kind: "problem",
        severity: it.costShare >= 0.3 ? "high" : "medium",
        confidence: confidenceOf(p),
        title: "Wysoki koszt przy małej liczbie konwersji",
        subject: it.c.name,
        situation: `Kampania odpowiada za ${share(it.costShare)} kosztu konta, ale tylko za ${share(it.convShare)} konwersji.`,
        evidence: [
          ...ev(it),
          {
            label: "Współczynnik konwersji",
            value: `${pct((it.cr ?? 0) * 100, 2)} (konto: ${pct(base.cr * 100, 2)})`,
          },
        ],
        cause:
          "Możliwe przyczyny: zbyt szerokie dopasowania i nietrafne zapytania, słabsza strona docelowa albo inny cel kampanii (np. zasięg). Sam wynik nie wskazuje, która z nich.",
        action:
          "Sprawdź raport wyszukiwanych haseł i typy dopasowania tej kampanii oraz jej strony docelowe. Ograniczenie budżetu rozważ dopiero po tej weryfikacji.",
        impact: `Szacunek: przy CPA ${targets.cpa ? "docelowym" : "konta"} (${money(targets.cpa ?? base.cpa)}) ten sam koszt dałby ok. ${n1(Math.round(expected * 10) / 10)} konwersji zamiast ${n1(conv)}.`,
        source: source(
          "udział w koszcie i konwersjach konta; test dwumianowy konwersji przy współczynniku potrzebnym do CPA konta"
        ),
        cost,
      })
      continue
    }

    // A2: high CPA (not flagged when conversion value keeps ROAS at or above the account).
    if (cpaLimit && it.cpa !== null && it.cpa >= cpaLimit && p < T.alpha && !valueOk) {
      flagged.add(it.c.key)
      findings.push({
        id: `A2:${it.c.key}`,
        rule: "A2",
        area: "campaign",
        kind: "problem",
        severity:
          it.costShare >= T.highCostShare
            ? "high"
            : it.costShare >= T.materialCostShare
              ? "medium"
              : "low",
        confidence: confidenceOf(p),
        title: "Wysoki koszt pozyskania konwersji (CPA)",
        subject: it.c.name,
        situation: `CPA kampanii jest ${n1(Math.round((it.cpa / (targets.cpa ?? base.cpa)) * 10) / 10)}× ${targets.cpa ? "wyższy od docelowego" : "wyższy niż średnia konta"}.`,
        evidence: [
          ...ev(it),
          ...(it.roas !== null
            ? [
                {
                  label: "ROAS",
                  value: `${pct(it.roas, 0)} (konto: ${base.roas !== null ? pct(base.roas, 0) : "N/D"})`,
                },
              ]
            : []),
        ],
        cause:
          "Wysoki CPA może wynikać z droższych kliknięć, niższej konwersji albo z innej wartości konwersji w tej kampanii. Nie dowodzi sam w sobie, że winne są słowa kluczowe lub strona docelowa.",
        action:
          "Porównaj CPC i współczynnik konwersji z resztą konta, sprawdź, czy kampania liczy te same działania konwersji. Jeśli wartość zamówień jest tu wyższa, oceniaj ją po ROAS, nie po CPA.",
        source: source(
          `CPA = koszt ÷ konwersje; próg: ${targets.cpa ? "cel × 1,2" : `${T.highCpaRatio}× CPA konta`}; test dwumianowy`
        ),
        cost,
      })
      continue
    }

    // A7: lots of traffic, conversion rate clearly below the account.
    const pCr = pLower(conv, clicks, base.cr)
    const medClicks = median(items.map((x) => x.m.clicks ?? 0)) ?? 0
    if (
      clicks >= medClicks &&
      conv >= 1 &&
      pCr < T.alpha &&
      it.cr !== null &&
      it.cr < base.cr * T.lowCrRatio
    ) {
      flagged.add(it.c.key)
      findings.push({
        id: `A7:${it.c.key}`,
        rule: "A7",
        area: "campaign",
        kind: "problem",
        severity: it.costShare >= T.materialCostShare ? "medium" : "low",
        confidence: confidenceOf(pCr),
        title: "Duży ruch, niski współczynnik konwersji",
        subject: it.c.name,
        situation: `Kampania ma ponadprzeciętną liczbę kliknięć, a konwertuje wyraźnie słabiej niż konto.`,
        evidence: [
          ...ev(it),
          {
            label: "Współczynnik konwersji",
            value: `${pct(it.cr * 100, 2)} (konto: ${pct(base.cr * 100, 2)})`,
          },
        ],
        cause:
          "Ruch może być mniej dopasowany do oferty albo strona docelowa słabiej przekonuje do działania.",
        action:
          "Przejrzyj wyszukiwane hasła i stronę docelową tej kampanii; sprawdź, czy śledzenie konwersji działa na wszystkich jej stronach.",
        source: source(
          "współczynnik konwersji = konwersje ÷ kliknięcia; test dwumianowy względem konta"
        ),
        cost,
      })
    }
  }

  // A3: low ROAS (value data needed), for campaigns not already flagged.
  if (base.roas !== null) {
    const limit = targets.roas ?? base.roas * T.lowRoasRatio
    for (const it of items) {
      if (flagged.has(it.c.key) || it.roas === null || it.costShare < T.materialCostShare)
        continue
      const conv = it.m.conversions ?? 0
      if (it.roas >= limit || conv < 3) continue
      flagged.add(it.c.key)
      findings.push({
        id: `A3:${it.c.key}`,
        rule: "A3",
        area: "campaign",
        kind: "problem",
        severity: it.costShare >= T.highCostShare ? "high" : "medium",
        confidence: conv >= 30 ? "high" : conv >= 10 ? "medium" : "low",
        title: "Niski ROAS",
        subject: it.c.name,
        situation: `Wartość konwersji względem kosztu jest ${targets.roas ? "poniżej celu" : `poniżej ${share(T.lowRoasRatio)} średniej konta`}.`,
        evidence: [
          ...ev(it),
          {
            label: "ROAS",
            value: `${pct(it.roas, 0)} (${targets.roas ? `cel: ${pct(targets.roas, 0)}` : `konto: ${pct(base.roas, 0)}`})`,
          },
          { label: "Wartość konwersji", value: money(it.m.conversionValue ?? 0) },
        ],
        cause:
          "Kampania może sprzedawać tańsze produkty, mieć niższą konwersję albo droższe kliknięcia. ROAS nie uwzględnia marży: niski ROAS nie zawsze oznacza stratę.",
        action:
          "Sprawdź, jakie produkty i zapytania generują tu konwersje oraz średnią wartość zamówienia. Do oceny opłacalności użyj analizy rentowności z marżą.",
        source: source(
          "ROAS = wartość konwersji ÷ koszt × 100%; pewność według liczby konwersji"
        ),
        cost: it.m.cost ?? 0,
      })
    }
  }

  // A6: very low CTR, compared only within the same campaign type.
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    const k = it.c.type ?? "?"
    groups.set(k, [...(groups.get(k) ?? []), it])
  }
  for (const [type, group] of groups) {
    for (const it of group) {
      const impressions = it.m.impressions ?? 0
      if (it.ctr === null || impressions < T.minImpressionsForCtr) continue
      const others = group.filter(
        (x) =>
          x !== it && x.ctr !== null && (x.m.impressions ?? 0) >= T.minImpressionsForCtr
      )
      if (others.length < 2) continue
      const med = median(others.map((x) => x.ctr!))!
      const p = pLower(it.m.clicks ?? 0, impressions, med)
      if (it.ctr >= med * T.lowCtrRatio || p >= T.alpha) continue
      findings.push({
        id: `A6:${it.c.key}`,
        rule: "A6",
        area: "campaign",
        kind: "problem",
        severity: "low",
        confidence: type === "?" ? "low" : confidenceOf(p),
        title: "Bardzo niski CTR",
        subject: it.c.name,
        situation: `CTR kampanii to mniej niż połowa mediany innych kampanii${type === "?" ? " (typ kampanii nieznany, porównanie przybliżone)" : ` typu „${type}”`}.`,
        evidence: [
          {
            label: "CTR",
            value: `${pct(it.ctr * 100, 2)} (mediana: ${pct(med * 100, 2)})`,
          },
          { label: "Wyświetlenia", value: n0(impressions) },
          { label: "Kliknięcia", value: n0(it.m.clicks) },
        ],
        cause:
          "Reklamy mogą słabo odpowiadać na zapytania albo kampania wyświetla się na zbyt szerokie hasła.",
        action:
          "Sprawdź trafność reklam i słów kluczowych, porównaj teksty reklam z kampaniami o wyższym CTR.",
        source: source(
          "CTR = kliknięcia ÷ wyświetlenia; mediana kampanii tego samego typu; test dwumianowy"
        ),
        cost: it.m.cost ?? 0,
      })
    }
  }

  // A4: budget concentration (information, not a problem by itself).
  for (const it of items)
    if (it.costShare >= T.concentrationShare && items.length > 1)
      findings.push({
        id: `A4:${it.c.key}`,
        rule: "A4",
        area: "campaign",
        kind: "data",
        severity: flagged.has(it.c.key) ? "medium" : "info",
        confidence: "high",
        title: "Większość budżetu w jednej kampanii",
        subject: it.c.name,
        situation: `Kampania zużywa ${share(it.costShare)} kosztu konta. Wyniki konta zależą w dużej mierze od niej.`,
        evidence: ev(it),
        cause: "To może być świadoma strategia (główna kampania sprzedażowa).",
        action: flagged.has(it.c.key)
          ? "Ta kampania ma też inne wykryte problemy: zacznij optymalizację od niej."
          : "Upewnij się, że podział budżetu odpowiada priorytetom biznesowym.",
        source: source("udział w koszcie konta"),
        cost: it.m.cost ?? 0,
      })

  // A8: strong performers that may deserve more budget.
  if (base.cpa && base.cr)
    for (const it of items) {
      const conv = it.m.conversions ?? 0
      const clicks = it.m.clicks ?? 0
      if (flagged.has(it.c.key) || it.cpa === null || conv < T.strongMinConversions)
        continue
      const ref = targets.cpa ?? base.cpa
      if (it.cpa > ref * T.strongCpaRatio) continue
      const p = pHigher(conv, clicks, Math.min(0.999, (it.m.cost ?? 0) / (ref * clicks)))
      if (p >= T.alpha) continue
      if (it.roas !== null && base.roas !== null && it.roas < base.roas) continue
      findings.push({
        id: `A8:${it.c.key}`,
        rule: "A8",
        area: "campaign",
        kind: "opportunity",
        severity: "low",
        confidence: confidenceOf(p),
        title: "Kampania z dobrymi wynikami: kandydat do zwiększenia budżetu",
        subject: it.c.name,
        situation: `CPA kampanii to ${share(it.cpa / ref)} ${targets.cpa ? "celu" : "średniej konta"} przy ${n1(conv)} konwersjach.`,
        evidence: [
          ...ev(it),
          ...(it.roas !== null
            ? [
                {
                  label: "ROAS",
                  value: `${pct(it.roas, 0)} (konto: ${base.roas !== null ? pct(base.roas, 0) : "N/D"})`,
                },
              ]
            : []),
        ],
        cause:
          "Kampania pozyskuje konwersje taniej niż reszta konta. Eksport nie zawiera udziału w wyświetleniach, więc nie wiadomo, czy ogranicza ją budżet.",
        action:
          "W Google Ads sprawdź „Utracony udział w wyświetleniach (budżet)”. Jeśli jest wysoki, zwiększaj budżet stopniowo (np. o 15–20%) i obserwuj CPA.",
        source: source("CPA względem konta; test dwumianowy liczby konwersji"),
        cost: it.m.cost ?? 0,
      })
    }

  // A9: swings between the two halves of the period (needs daily campaign data).
  findings.push(...swingRules(ctx))

  // A10: not enough data to judge.
  if (base.cr) {
    const minClicks = clicksToJudge(base.cr)
    const thin = items.filter(
      (it) =>
        (it.m.cost ?? 0) > 0 &&
        (it.m.clicks ?? 0) < minClicks &&
        (it.m.conversions ?? 0) < 3
    )
    if (thin.length)
      findings.push({
        id: "A10",
        rule: "A10",
        area: "campaign",
        kind: "data",
        severity: "info",
        confidence: "high",
        title: "Kampanie bez wystarczających danych do oceny",
        subject: thin.map((it) => it.c.name).join(", "),
        situation: `${thin.length} ${thin.length === 1 ? "kampania ma" : "kampanie mają"} mniej niż ${minClicks} kliknięć, czyli za mało, by ocenić konwersję przy współczynniku konta ${pct(base.cr * 100, 2)}.`,
        evidence: thin.slice(0, 6).map((it) => ({
          label: it.c.name,
          value: `${n0(it.m.clicks)} klikn., ${money(it.m.cost ?? 0)}, ${n1(it.m.conversions)} konw.`,
        })),
        cause: "Mały budżet, krótki czas działania albo niski popyt.",
        action:
          "Nie wyciągaj wniosków o skuteczności tych kampanii. Oceń je ponownie po zebraniu większej liczby kliknięć.",
        source: source(`minimalna liczba kliknięć: (1 − ${pct(base.cr * 100, 2)})ⁿ < 5%`),
        cost: thin.reduce((s, it) => s + (it.m.cost ?? 0), 0),
      })
  }

  return { findings, notes }
}

/** A9: CPA in the first vs second half of the period, per campaign, from daily data. */
function swingRules(ctx: RuleContext): Finding[] {
  const { data, money } = ctx
  const report = data.reports
    .filter((r) =>
      r.records.some((x) => x.dims.date && (x.dims.campaign || x.dims.campaignId))
    )
    .sort((a, b) => (a === data.primary ? -1 : b === data.primary ? 1 : 0))[0]
  if (!report) return []
  const keys = data.campaignKeyOf.get(report.id) ?? []
  const days = [
    ...new Set(report.records.map((r) => r.dims.date).filter(Boolean) as string[]),
  ].sort()
  if (days.length < 14) return []
  const mid = days[Math.floor(days.length / 2)]
  const halves = new Map<string, [Metrics, Metrics]>()
  report.records.forEach((r, i) => {
    const k = keys[i]
    if (!k || !r.dims.date) return
    const h = halves.get(k) ?? [emptyMetrics(), emptyMetrics()]
    addInto(h[r.dims.date < mid ? 0 : 1], r.metrics)
    halves.set(k, h)
  })
  const out: Finding[] = []
  for (const [key, [a, b]] of halves) {
    const ca = kpisOf(a).cpa
    const cb = kpisOf(b).cpa
    if (!ca.ok || !cb.ok) continue
    if (
      (a.conversions ?? 0) < T.swingMinConversions ||
      (b.conversions ?? 0) < T.swingMinConversions
    )
      continue
    const change = (cb.value - ca.value) / ca.value
    if (Math.abs(change) < T.swingRatio) continue
    const name = data.campaigns.find((c) => c.key === key)?.name ?? key
    out.push({
      id: `A9:${key}`,
      rule: "A9",
      area: "campaign",
      kind: "data",
      severity: change > 0 ? "medium" : "info",
      confidence: "medium",
      title:
        change > 0
          ? "CPA wyraźnie wzrósł w drugiej połowie okresu"
          : "CPA wyraźnie spadł w drugiej połowie okresu",
      subject: name,
      situation: `CPA zmienił się o ${pct(Math.abs(change) * 100, 0)} między pierwszą a drugą połową okresu.`,
      evidence: [
        {
          label: `CPA do ${mid}`,
          value: `${money(ca.value)} (${n1(a.conversions)} konw.)`,
        },
        {
          label: `CPA od ${mid}`,
          value: `${money(cb.value)} (${n1(b.conversions)} konw.)`,
        },
      ],
      cause:
        "Zmiana może wynikać ze zmian w kampanii, sezonowości, konkurencji albo opóźnionego raportowania konwersji z ostatnich dni.",
      action:
        "Sprawdź historię zmian kampanii w tym okresie. Ostatnie dni porównuj ostrożnie: konwersje mogą jeszcze spływać.",
      source: {
        report: report.name,
        dimension: "Kampania × dzień",
        period: periodOf(report),
        method: "CPA w dwóch połowach okresu, każda połowa co najmniej 5 konwersji",
      },
      cost: (a.cost ?? 0) + (b.cost ?? 0),
    })
  }
  return out
}
