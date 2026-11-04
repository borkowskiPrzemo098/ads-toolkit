import { confidenceOf, type Finding } from "../findings"
import { addInto, emptyMetrics, kpisOf, sumMetrics, type Metrics } from "../metrics"
import { nameKey, type NormalizedReport } from "../normalize"
import { clicksToJudge, median, pHigher, pLower } from "../stats"
import { T } from "../thresholds"
import { baselineOf, n0, n1, pct, periodOf, share, type RuleContext } from "./context"
import type { RuleResult } from "./campaigns"

/*
 * Keyword rules (spec 5B). Benchmarks come from the keyword report itself (like-for-like:
 * campaigns without keywords, e.g. Performance Max, would distort an account-wide rate).
 * A keyword is judged only with enough clicks; smaller samples are listed, never condemned.
 */

const MATCH_LABEL = {
  exact: "ścisłe",
  phrase: "do wyrażenia",
  broad: "przybliżone",
} as const
/** Individual findings per rule; the rest is summarised so the list stays usable. */
const MAX_PER_RULE = 12

interface Kw {
  key: string
  text: string
  label: string
  campaign: string
  adGroup: string
  match?: keyof typeof MATCH_LABEL
  m: Metrics
}

export function pickKeywordReport(ctx: RuleContext): NormalizedReport | null {
  const reports = ctx.data.reports.filter(
    (r) => r.type === "keyword" && r.records.some((x) => x.metrics.cost !== null)
  )
  const primaryPeriod = ctx.data.primary?.period
  return (
    reports.sort(
      (a, b) =>
        Number(!!primaryPeriod && b.period?.from === primaryPeriod.from) -
          Number(!!primaryPeriod && a.period?.from === primaryPeriod.from) ||
        b.records.length - a.records.length
    )[0] ?? null
  )
}

export function keywordRules(ctx: RuleContext): RuleResult {
  const report = pickKeywordReport(ctx)
  if (!report)
    return {
      findings: [],
      notes: ["Analiza słów kluczowych wymaga raportu słów kluczowych z kosztem."],
    }
  const { money, data } = ctx

  // Merge rows of the same keyword (e.g. a report segmented by day or device).
  const map = new Map<string, Kw>()
  const cKeys = data.campaignKeyOf.get(report.id) ?? []
  report.records.forEach((r, i) => {
    const text = r.dims.keyword
    if (!text) return
    const campaign =
      r.dims.campaign ??
      (cKeys[i] ? data.campaigns.find((c) => c.key === cKeys[i])?.name : undefined) ??
      "—"
    const adGroup = r.dims.adGroup ?? "—"
    const key = [
      cKeys[i] ?? campaign,
      nameKey(adGroup),
      nameKey(text),
      r.dims.matchType ?? "",
    ].join("|")
    const kw = map.get(key) ?? {
      key,
      text,
      label: r.dims.matchType ? `${text} [${MATCH_LABEL[r.dims.matchType]}]` : text,
      campaign,
      adGroup,
      match: r.dims.matchType,
      m: emptyMetrics(),
    }
    addInto(kw.m, r.metrics)
    map.set(key, kw)
  })
  const kws = [...map.values()]
  const totals = sumMetrics(kws.map((k) => k.m))
  const base = baselineOf(totals)
  const totalCost = totals.cost ?? 0
  const source = (method: string) => ({
    report: report.name,
    dimension: "Słowo kluczowe",
    period: periodOf(report),
    method,
  })
  const where = (k: Kw) => `${k.campaign} › ${k.adGroup}`
  const ev = (k: Kw) => {
    const kp = kpisOf(k.m)
    return [
      { label: "Kampania › grupa", value: where(k) },
      { label: "Koszt", value: money(k.m.cost ?? 0) },
      { label: "Kliknięcia", value: n0(k.m.clicks) },
      { label: "Konwersje", value: n1(k.m.conversions) },
      {
        label: "CPA",
        value: kp.cpa.ok
          ? `${money(kp.cpa.value)} (słowa kluczowe: ${base.cpa ? money(base.cpa) : "N/D"})`
          : "N/D (brak konwersji)",
      },
    ]
  }

  const findings: Finding[] = []
  const notes: string[] = []
  const flagged = new Set<string>()
  if (!base.cr || !base.cpa) {
    notes.push(
      "Raport słów kluczowych nie ma konwersji, więc reguły oparte na CPA i konwersji zostały pominięte."
    )
  }
  const minClicks = base.cr ? clicksToJudge(base.cr) : Infinity
  const byCost = [...kws].sort((a, b) => (b.m.cost ?? 0) - (a.m.cost ?? 0))
  const capped = (
    list: Finding[],
    rule: string,
    summary: (rest: Finding[]) => Finding
  ): Finding[] =>
    list.length <= MAX_PER_RULE
      ? list
      : [...list.slice(0, MAX_PER_RULE), summary(list.slice(MAX_PER_RULE))]

  // B1: cost without conversions, with enough clicks to mean something.
  if (base.cr && base.cpa) {
    const b1: Finding[] = []
    for (const k of byCost) {
      const clicks = k.m.clicks ?? 0
      const cost = k.m.cost ?? 0
      if ((k.m.conversions ?? 0) > 0 || clicks < minClicks || !cost) continue
      flagged.add(k.key)
      const p = Math.pow(1 - base.cr, clicks)
      b1.push({
        id: `B1:${k.key}`,
        rule: "B1",
        area: "keyword",
        kind: "problem",
        severity: cost >= base.cpa * 2 ? "high" : cost >= base.cpa ? "medium" : "low",
        confidence: confidenceOf(p),
        title: "Słowo kluczowe z kosztem bez konwersji",
        subject: k.label,
        situation: `${n0(clicks)} kliknięć bez żadnej konwersji. Przy współczynniku konwersji słów kluczowych (${pct(base.cr * 100, 2)}) spodziewalibyśmy się ok. ${n1(Math.round(clicks * base.cr * 10) / 10)}.`,
        evidence: ev(k),
        cause:
          "Słowo może przyciągać zapytania o innej intencji (szczególnie przy dopasowaniu przybliżonym) albo prowadzić na niedopasowaną stronę.",
        action: `Sprawdź wyszukiwane hasła dla tego słowa${k.match === "broad" ? " i rozważ węższe dopasowanie" : ""}. Wstrzymanie lub wykluczenia rozważ po tej weryfikacji.`,
        impact: `Koszt bez konwersji w okresie raportu: ${money(cost)} (${share(cost / totalCost)} kosztu słów kluczowych).`,
        source: source(
          `minimalna liczba kliknięć: (1 − ${pct(base.cr * 100, 2)})ⁿ < 5%, czyli ${minClicks}`
        ),
        cost,
      })
    }
    findings.push(
      ...capped(b1, "B1", (rest) => ({
        id: "B1:rest",
        rule: "B1",
        area: "keyword",
        kind: "problem",
        severity: "medium",
        confidence: "medium",
        title: `Kolejne słowa kluczowe z kosztem bez konwersji (${rest.length})`,
        subject:
          rest
            .slice(0, 5)
            .map((f) => f.subject)
            .join(", ") + (rest.length > 5 ? "…" : ""),
        situation: `Pozostałe słowa spełniające tę samą regułę, o mniejszym koszcie.`,
        evidence: [
          { label: "Łączny koszt", value: money(rest.reduce((s, f) => s + f.cost, 0)) },
        ],
        cause: "Jak wyżej.",
        action:
          "Przejrzyj je po zajęciu się droższymi słowami. Pełna lista jest w eksporcie CSV audytu.",
        source: rest[0].source,
        cost: rest.reduce((s, f) => s + f.cost, 0),
      }))
    )

    // B2: very high CPA, B3: many clicks and low conversion rate.
    const b2: Finding[] = []
    const b3: Finding[] = []
    const medClicks = median(kws.map((k) => k.m.clicks ?? 0)) ?? 0
    for (const k of byCost) {
      const clicks = k.m.clicks ?? 0
      const conv = k.m.conversions ?? 0
      const cost = k.m.cost ?? 0
      if (flagged.has(k.key) || conv < 1 || !clicks) continue
      const cpa = cost / conv
      const needed = Math.min(0.999, cost / (base.cpa * clicks))
      const p = pLower(conv, clicks, needed)
      if (cpa >= base.cpa * T.keywordHighCpaRatio && p < T.alpha) {
        flagged.add(k.key)
        b2.push({
          id: `B2:${k.key}`,
          rule: "B2",
          area: "keyword",
          kind: "problem",
          severity: cost / totalCost >= T.materialCostShare ? "high" : "medium",
          confidence: confidenceOf(p),
          title: "Bardzo wysoki CPA słowa kluczowego",
          subject: k.label,
          situation: `CPA jest ${n1(Math.round((cpa / base.cpa) * 10) / 10)}× wyższy niż średnio w słowach kluczowych.`,
          evidence: [
            ...ev(k),
            {
              label: "Współczynnik konwersji",
              value: `${pct((conv / clicks) * 100, 2)} (słowa: ${pct(base.cr * 100, 2)})`,
            },
          ],
          cause:
            "Drogie kliknięcia albo niska konwersja; przy słowach ogólnych często obie rzeczy naraz.",
          action:
            "Sprawdź stawki i wyszukiwane hasła tego słowa. Jeśli konwersje mają wysoką wartość, oceń je po ROAS przed obniżeniem stawek.",
          impact: `Szacunek: przy średnim CPA słów kluczowych ten koszt dałby ok. ${n1(Math.round((cost / base.cpa) * 10) / 10)} konwersji zamiast ${n1(conv)}.`,
          source: source(
            `CPA ≥ ${T.keywordHighCpaRatio}× średni CPA słów kluczowych; test dwumianowy`
          ),
          cost,
        })
        continue
      }
      const pCr = pLower(conv, clicks, base.cr)
      if (
        clicks >= medClicks &&
        pCr < T.alpha &&
        conv / clicks < base.cr * T.lowCrRatio
      ) {
        flagged.add(k.key)
        b3.push({
          id: `B3:${k.key}`,
          rule: "B3",
          area: "keyword",
          kind: "problem",
          severity: "medium",
          confidence: confidenceOf(pCr),
          title: "Dużo kliknięć, niski współczynnik konwersji",
          subject: k.label,
          situation: `Słowo ma ponadprzeciętny ruch, ale konwertuje wyraźnie słabiej niż średnia słów kluczowych.`,
          evidence: [
            ...ev(k),
            {
              label: "Współczynnik konwersji",
              value: `${pct((conv / clicks) * 100, 2)} (słowa: ${pct(base.cr * 100, 2)})`,
            },
          ],
          cause: "Możliwa szeroka intencja zapytań albo niedopasowana strona docelowa.",
          action:
            "Przejrzyj wyszukiwane hasła dla tego słowa i stronę docelową grupy reklam.",
          source: source(
            "współczynnik konwersji = konwersje ÷ kliknięcia; test dwumianowy"
          ),
          cost,
        })
      }
    }
    findings.push(
      ...capped(b2, "B2", (rest) =>
        summary("B2", "Kolejne słowa z bardzo wysokim CPA", rest, money)
      )
    )
    findings.push(
      ...capped(b3, "B3", (rest) =>
        summary("B3", "Kolejne słowa z niskim współczynnikiem konwersji", rest, money)
      )
    )
  }

  // CTR rules need impressions.
  const withCtr = kws.filter(
    (k) => (k.m.impressions ?? 0) >= T.minImpressionsForCtr && k.m.clicks !== null
  )
  const medCtr = median(withCtr.map((k) => (k.m.clicks ?? 0) / (k.m.impressions ?? 1)))
  if (medCtr && withCtr.length >= 3) {
    for (const k of withCtr) {
      const ctr = (k.m.clicks ?? 0) / k.m.impressions!
      const clicks = k.m.clicks ?? 0
      const conv = k.m.conversions ?? 0
      // B4: high CTR and conversion rate clearly above average.
      if (base.cr && ctr >= medCtr * T.keywordHighCtrRatio && !flagged.has(k.key)) {
        const p = pHigher(conv, clicks, base.cr)
        if (p < T.alpha) {
          flagged.add(k.key)
          findings.push({
            id: `B4:${k.key}`,
            rule: "B4",
            area: "keyword",
            kind: "opportunity",
            severity: "low",
            confidence: confidenceOf(p),
            title: "Wysoki CTR i dobra konwersja",
            subject: k.label,
            situation: `CTR ${pct(ctr * 100, 2)} (mediana: ${pct(medCtr * 100, 2)}) i współczynnik konwersji ${pct((conv / clicks) * 100, 2)} (średnio: ${pct(base.cr * 100, 2)}).`,
            evidence: ev(k),
            cause: "Słowo dobrze odpowiada intencji użytkowników i ofercie.",
            action:
              "Sprawdź udział w wyświetleniach tego słowa; jeśli jest niski, rozważ wyższą stawkę lub budżet. Podobne frazy mogą być kandydatami na nowe słowa kluczowe.",
            source: source("CTR względem mediany słów; test dwumianowy konwersji"),
            cost: k.m.cost ?? 0,
          })
          continue
        }
      }
      // B5: very low CTR.
      const pCtr = pLower(clicks, k.m.impressions!, medCtr)
      if (ctr < medCtr * T.keywordLowCtrRatio && pCtr < T.alpha && !flagged.has(k.key))
        findings.push({
          id: `B5:${k.key}`,
          rule: "B5",
          area: "keyword",
          kind: "problem",
          severity: "low",
          confidence: confidenceOf(pCtr),
          title: "Bardzo niski CTR słowa kluczowego",
          subject: k.label,
          situation: `CTR ${pct(ctr * 100, 2)} to mniej niż ${share(T.keywordLowCtrRatio)} mediany słów kluczowych (${pct(medCtr * 100, 2)}).`,
          evidence: [
            { label: "Kampania › grupa", value: where(k) },
            { label: "Wyświetlenia", value: n0(k.m.impressions) },
            { label: "Kliknięcia", value: n0(clicks) },
          ],
          cause:
            "Słowo może być zbyt ogólne albo reklamy w grupie słabo do niego pasują.",
          action:
            "Sprawdź, czy słowo jest potrzebne, i dopasuj nagłówki reklam do jego treści.",
          source: source(
            "CTR = kliknięcia ÷ wyświetlenia względem mediany słów; test dwumianowy"
          ),
          cost: k.m.cost ?? 0,
        })
    }
  }

  // B6: the same keyword in several ad groups or campaigns.
  const byText = new Map<string, Kw[]>()
  for (const k of kws)
    byText.set(nameKey(k.text), [...(byText.get(nameKey(k.text)) ?? []), k])
  for (const [, list] of byText) {
    const places = new Set(list.map(where))
    if (places.size < 2) continue
    const cost = list.reduce((s, k) => s + (k.m.cost ?? 0), 0)
    findings.push({
      id: `B6:${nameKey(list[0].text)}`,
      rule: "B6",
      area: "keyword",
      kind: "problem",
      severity: "medium",
      confidence: "high",
      title: "To samo słowo kluczowe w kilku grupach reklam",
      subject: list[0].text,
      situation: `Słowo występuje w ${places.size} miejscach. Grupy mogą konkurować o te same zapytania, a wyniki rozkładają się na kilka miejsc.`,
      evidence: list.map((k) => ({
        label: `${where(k)}${k.match ? ` [${MATCH_LABEL[k.match]}]` : ""}`,
        value: `${money(k.m.cost ?? 0)}, ${n1(k.m.conversions)} konw.`,
      })),
      cause: "Słowo dodane w kilku grupach, często z różnymi typami dopasowania.",
      action:
        "Zdecyduj, która grupa ma obsługiwać to zapytanie (np. ta z lepszą reklamą i stroną), a w pozostałych dodaj je jako wykluczające.",
      source: source(
        "ten sam tekst słowa (bez wielkości liter i polskich znaków) w różnych grupach reklam"
      ),
      cost,
    })
  }

  // B7: the expensive half of spend with above-average CPA, not flagged elsewhere.
  if (base.cpa) {
    let running = 0
    for (const k of byCost) {
      if (running >= totalCost * T.topSpendShare) break
      running += k.m.cost ?? 0
      const kp = kpisOf(k.m)
      if (flagged.has(k.key) || !kp.cpa.ok || kp.cpa.value <= base.cpa) continue
      flagged.add(k.key)
      findings.push({
        id: `B7:${k.key}`,
        rule: "B7",
        area: "keyword",
        kind: "problem",
        severity: "low",
        confidence: "low",
        title: "Drogie słowo kluczowe do weryfikacji",
        subject: k.label,
        situation: `Słowo należy do grupy najdroższych (połowa kosztu słów kluczowych), a jego CPA jest powyżej średniej. Różnica nie jest jednak na tyle duża, by uznać ją za pewny problem.`,
        evidence: ev(k),
        cause: "Może to być normalna zmienność albo początek problemu.",
        action:
          "Obserwuj to słowo w kolejnych tygodniach; przy następnym audycie porównaj CPA.",
        source: source(
          `najdroższe słowa do ${share(T.topSpendShare)} kosztu; CPA powyżej średniej`
        ),
        cost: k.m.cost ?? 0,
      })
    }
  }

  // B8: cheap conversions, candidates for more budget or testing.
  if (base.cpa && base.cr)
    for (const k of byCost) {
      const conv = k.m.conversions ?? 0
      const clicks = k.m.clicks ?? 0
      if (flagged.has(k.key) || conv < T.keywordStrongMinConversions || !clicks) continue
      const cpa = (k.m.cost ?? 0) / conv
      if (cpa > base.cpa * T.strongCpaRatio) continue
      const p = pHigher(
        conv,
        clicks,
        Math.min(0.999, (k.m.cost ?? 0) / (base.cpa * clicks))
      )
      if (p >= T.alpha) continue
      findings.push({
        id: `B8:${k.key}`,
        rule: "B8",
        area: "keyword",
        kind: "opportunity",
        severity: "info",
        confidence: confidenceOf(p),
        title: "Słowo z tanimi konwersjami: kandydat do większego budżetu lub testów",
        subject: k.label,
        situation: `CPA to ${share(cpa / base.cpa)} średniej słów kluczowych przy ${n1(conv)} konwersjach.`,
        evidence: ev(k),
        cause: "Słowo dobrze trafia w intencję zakupową.",
        action:
          "Sprawdź udział w wyświetleniach i pozycję reklamy; rozważ wyższą stawkę albo osobną grupę reklam z dopasowaną reklamą.",
        source: source(`CPA ≤ ${share(T.strongCpaRatio)} średniego; test dwumianowy`),
        cost: k.m.cost ?? 0,
      })
    }

  // Not enough data: listed so nobody excludes a keyword after one or two clicks.
  if (base.cr) {
    const thin = kws.filter(
      (k) =>
        (k.m.cost ?? 0) > 0 &&
        (k.m.conversions ?? 0) === 0 &&
        (k.m.clicks ?? 0) < minClicks
    )
    if (thin.length)
      findings.push({
        id: "B0",
        rule: "B0",
        area: "keyword",
        kind: "data",
        severity: "info",
        confidence: "high",
        title: "Słowa bez konwersji, ale ze zbyt małą liczbą kliknięć do oceny",
        subject: `${thin.length} ${thin.length === 1 ? "słowo" : "słów"}`,
        situation: `Mają mniej niż ${minClicks} kliknięć. Brak konwersji przy takiej próbie może być przypadkiem.`,
        evidence: [
          {
            label: "Łączny koszt",
            value: money(thin.reduce((s, k) => s + (k.m.cost ?? 0), 0)),
          },
          ...thin
            .slice(0, 5)
            .map((k) => ({
              label: k.label,
              value: `${n0(k.m.clicks)} klikn., ${money(k.m.cost ?? 0)}`,
            })),
        ],
        cause: "Mały ruch.",
        action:
          "Nie wykluczaj ani nie wstrzymuj tych słów tylko z powodu braku konwersji. Wróć do nich po zebraniu danych.",
        source: source(`minimalna liczba kliknięć: ${minClicks}`),
        cost: thin.reduce((s, k) => s + (k.m.cost ?? 0), 0),
      })
  }

  return { findings, notes }
}

function summary(
  rule: string,
  title: string,
  rest: Finding[],
  money: (v: number) => string
): Finding {
  const cost = rest.reduce((s, f) => s + f.cost, 0)
  return {
    ...rest[0],
    id: `${rule}:rest`,
    title: `${title} (${rest.length})`,
    subject:
      rest
        .slice(0, 5)
        .map((f) => f.subject)
        .join(", ") + (rest.length > 5 ? "…" : ""),
    situation: "Pozostałe słowa spełniające tę samą regułę, o mniejszym koszcie.",
    evidence: [{ label: "Łączny koszt", value: money(cost) }],
    impact: undefined,
    cost,
  }
}
