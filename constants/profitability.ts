import type { MetricKind } from "@/lib/formatting/metric"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import type { ProfitabilityField } from "@/lib/validators/profitability"

export type { MetricKind }

/** Which direction is good when comparing campaigns; null = neither (context-dependent). */
export type MetricDirection = "higher" | "lower" | null

type ResultMetricKey = {
  [K in keyof ProfitabilityResult]: ProfitabilityResult[K] extends { ok: boolean }
    ? K
    : never
}[keyof ProfitabilityResult]

export interface MetricDef {
  key: ResultMetricKey
  label: string
  kind: MetricKind
  better: MetricDirection
  /** Plain-language meaning and formula, shown on hover and in exports. */
  help: string
}

export interface MetricGroup {
  title: string
  metrics: MetricDef[]
}

export const PROFITABILITY_GROUPS: MetricGroup[] = [
  {
    title: "Wynik finansowy",
    metrics: [
      {
        key: "netProfit",
        label: "Zysk netto kampanii",
        kind: "currency",
        better: "higher",
        help: "Przychód minus koszt towaru, reklama i koszty dodatkowe.",
      },
      {
        key: "roi",
        label: "ROI",
        kind: "percent",
        better: "higher",
        help: "Zysk netto ÷ wszystkie koszty (towar, reklama, koszty dodatkowe) × 100%.",
      },
      {
        key: "profitAfterAds",
        label: "Zysk po kosztach reklamy (z marży)",
        kind: "currency",
        better: "higher",
        help: "Przychód × marża − koszt reklamy − koszty dodatkowe.",
      },
      {
        key: "profitAfterProductCost",
        label: "Zysk po koszcie produktu",
        kind: "currency",
        better: "higher",
        help: "Przychód − koszt produktu × konwersje − koszt reklamy − koszty dodatkowe.",
      },
      {
        key: "totalCosts",
        label: "Koszty łącznie",
        kind: "currency",
        better: null,
        help: "Koszt towaru + koszt reklamy + koszty dodatkowe.",
      },
    ],
  },
  {
    title: "Sprzedaż i zwrot z reklamy",
    metrics: [
      {
        key: "revenue",
        label: "Przychód",
        kind: "currency",
        better: "higher",
        help: "Wartość sprzedaży przypisana do kampanii. To nie jest zysk.",
      },
      {
        key: "roas",
        label: "ROAS",
        kind: "percent",
        better: "higher",
        help: "Przychód ÷ koszt reklamy × 100%. Nie uwzględnia marży ani innych kosztów.",
      },
      {
        key: "breakEvenRoas",
        label: "Break-even ROAS",
        kind: "percent",
        better: "lower",
        help: "1 ÷ marża. Poniżej tego ROAS reklama nie pokrywa się z marży.",
      },
      {
        key: "avgOrderValue",
        label: "Średnia wartość zamówienia",
        kind: "currency",
        better: "higher",
        help: "Przychód ÷ konwersje, jeśli nie podasz jej wprost.",
      },
    ],
  },
  {
    title: "Koszt pozyskania",
    metrics: [
      {
        key: "cpa",
        label: "CPA",
        kind: "currency",
        better: "lower",
        help: "Koszt reklamy ÷ konwersje.",
      },
      {
        key: "maxCpa",
        label: "Maksymalny CPA",
        kind: "currency",
        better: "higher",
        help: "Średnia wartość zamówienia × marża − koszty dodatkowe na konwersję.",
      },
      {
        key: "breakEvenCpa",
        label: "Break-even CPA",
        kind: "currency",
        better: "higher",
        help: "Średnia wartość zamówienia × marża. CPA, przy którym marża równa się reklamie.",
      },
      {
        key: "cpc",
        label: "CPC",
        kind: "currency",
        better: "lower",
        help: "Koszt reklamy ÷ kliknięcia.",
      },
    ],
  },
  {
    title: "Ruch",
    metrics: [
      {
        key: "ctr",
        label: "CTR",
        kind: "percent",
        better: "higher",
        help: "Kliknięcia ÷ wyświetlenia × 100%.",
      },
      {
        key: "conversionRate",
        label: "Współczynnik konwersji",
        kind: "percent",
        better: "higher",
        help: "Konwersje ÷ kliknięcia × 100%.",
      },
    ],
  },
]

export const ALL_PROFITABILITY_METRICS = PROFITABILITY_GROUPS.flatMap((g) => g.metrics)

export interface FieldDef {
  key: ProfitabilityField
  label: string
  unit: "currency" | "%" | null
  placeholder: string
  optional?: boolean
  hint?: string
}

export interface FieldGroup {
  title: string
  fields: FieldDef[]
}

export const PROFITABILITY_FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Koszty i ruch",
    fields: [
      {
        key: "adSpend",
        label: "Koszt reklamy",
        unit: "currency",
        placeholder: "np. 2000",
      },
      { key: "clicks", label: "Kliknięcia", unit: null, placeholder: "np. 1000" },
      { key: "conversions", label: "Konwersje", unit: null, placeholder: "np. 40" },
      {
        key: "impressions",
        label: "Wyświetlenia",
        unit: null,
        placeholder: "np. 50000",
        optional: true,
        hint: "Tylko do CTR.",
      },
    ],
  },
  {
    title: "Sprzedaż",
    fields: [
      {
        key: "revenue",
        label: "Przychód z kampanii",
        unit: "currency",
        placeholder: "np. 12000",
        hint: "Wartość konwersji z Google Ads.",
      },
      {
        key: "avgOrderValue",
        label: "Średnia wartość zamówienia",
        unit: "currency",
        placeholder: "np. 300",
        optional: true,
        hint: "Pusta: liczymy przychód ÷ konwersje.",
      },
    ],
  },
  {
    title: "Marża i koszty",
    fields: [
      {
        key: "marginPercent",
        label: "Marża",
        unit: "%",
        placeholder: "np. 30",
        hint: "Część przychodu, która zostaje po koszcie towaru.",
      },
      {
        key: "extraCosts",
        label: "Koszty dodatkowe",
        unit: "currency",
        placeholder: "np. 300",
        optional: true,
        hint: "Obsługa agencji, narzędzia, kreacje.",
      },
      {
        key: "productCostPerConversion",
        label: "Koszt produktu na konwersję",
        unit: "currency",
        placeholder: "np. 180",
        optional: true,
        hint: "Dokładniejszy niż marża. Gdy go podasz, zysk netto liczymy od niego.",
      },
    ],
  },
]
