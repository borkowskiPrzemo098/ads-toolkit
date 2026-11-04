/**
 * Every threshold the audit rules use, with the reason it exists. There is no universal "good
 * CPA": entities are compared with the account's own averages (or the user's targets), and
 * a rule fires only when the sample makes the gap unlikely to be chance.
 */
export const T = {
  /** Significance for "worse/better than the account" (binomial test on conversions). */
  alpha: 0.05,
  /** Share of spend from which a campaign matters for budget questions. */
  materialCostShare: 0.05,
  /** "High cost, few conversions": spend share at least this… */
  highCostShare: 0.15,
  /** …and conversion share below this fraction of the spend share. */
  convShareRatio: 0.5,
  /** CPA this many times the account CPA (or target × 1.2) is "high". */
  highCpaRatio: 1.5,
  /** ROAS below this fraction of the account ROAS (or below target) is "low". */
  lowRoasRatio: 0.6,
  /** "Low conversion rate" also needs the rate below this fraction of the average. */
  lowCrRatio: 0.7,
  /** One campaign above this share of spend is a concentration worth knowing. */
  concentrationShare: 0.5,
  /** CTR below this fraction of the median CTR of the same campaign type is "very low". */
  lowCtrRatio: 0.5,
  /** Minimum impressions before CTR is judged. */
  minImpressionsForCtr: 1000,
  /** Strong performer: CPA at most this fraction of the account CPA. */
  strongCpaRatio: 0.7,
  /** Strong performer needs at least this many conversions. */
  strongMinConversions: 10,
  /** Period halves: CPA change from this ratio counts as a swing… */
  swingRatio: 0.5,
  /** …when each half has at least this many conversions. */
  swingMinConversions: 5,
  /** Keyword CPA this many times the keyword-report CPA is "very high". */
  keywordHighCpaRatio: 2,
  /** Keyword CTR above this many times the median keyword CTR is "high". */
  keywordHighCtrRatio: 1.5,
  /** Keyword CTR below this fraction of the median keyword CTR is "very low". */
  keywordLowCtrRatio: 0.3,
  /** Expensive keywords: the set that makes up this share of keyword spend. */
  topSpendShare: 0.5,
  /** Budget candidate keywords need at least this many conversions. */
  keywordStrongMinConversions: 3,
} as const

/** Shown on the audit screen under "Jak liczymy". */
export const METHOD_NOTES: string[] = [
  "Punktem odniesienia są średnie Twojego konta (albo podane cele CPA/ROAS), a nie progi branżowe.",
  `Reguła zgłasza różnicę dopiero wtedy, gdy przypadek jest mało prawdopodobny: test dwumianowy liczby konwersji przy współczynniku konwersji konta, poziom istotności ${T.alpha * 100}%. Pewność „wysoka” oznacza p < 0,001, „średnia” p < 0,01, „niska” p < 0,05.`,
  "Brak konwersji jest istotny dopiero po liczbie kliknięć, przy której (1 − współczynnik konwersji)ⁿ < 5%. Przy 3% to około 100 kliknięć, przy 1% około 300. Mniejsze próby trafiają do „za mało danych”, a nie do problemów.",
  `Wysoki koszt przy małej liczbie konwersji: kampania ma co najmniej ${T.highCostShare * 100}% kosztu konta, a jej udział w konwersjach jest mniej niż o połowę mniejszy.`,
  `Wysoki CPA: co najmniej ${T.highCpaRatio}× CPA konta (słowa kluczowe: ${T.keywordHighCpaRatio}×). Nie jest zgłaszany, gdy wartość konwersji daje ROAS nie niższy niż średnia konta.`,
  `Niski ROAS: poniżej ${T.lowRoasRatio * 100}% ROAS konta (albo poniżej celu), przy co najmniej ${T.materialCostShare * 100}% kosztu.`,
  `Niski CTR: poniżej ${T.lowCtrRatio * 100}% mediany CTR kampanii tego samego typu, od ${T.minImpressionsForCtr} wyświetleń. CTR kampanii różnych typów (np. Search i Display) nie jest porównywany.`,
  "Szacowany wpływ to prosty rachunek na danych z okresu raportu, nie prognoza. Nie uwzględnia zmian w aukcji, sezonowości ani udziału w wyświetleniach.",
]
