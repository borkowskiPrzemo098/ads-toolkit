import { SEVERITY_ORDER, type Finding, type Severity } from "./findings"
import type { Priority } from "./recommendations"

/*
 * Action plan (spec section 11): findings grouped into tasks such as "Sprawdzić wyszukiwane
 * hasła". Each task has a priority, description, justification and a status the user sets.
 * The tool never changes the Google Ads account.
 */

export type TaskStatus = "todo" | "doing" | "done"

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Do zrobienia",
  doing: "W trakcie",
  done: "Zrobione",
}

export interface Task {
  id: string
  title: string
  description: string
  justification: string
  priority: Priority
  /** Elements the task is about (campaigns, keywords…). */
  subjects: string[]
  cost: number
}

interface Template {
  title: string
  description: string
}

const T: Record<string, Template> = {
  campaignWaste: {
    title: "Przeanalizować kampanie z wysokim kosztem i małą liczbą konwersji",
    description:
      "Sprawdź w nich wyszukiwane hasła, typy dopasowania i strony docelowe; budżet zmieniaj dopiero po tej weryfikacji.",
  },
  campaignCpa: {
    title: "Zweryfikować kampanie z wysokim CPA",
    description:
      "Porównaj CPC, współczynnik konwersji i liczone działania konwersji z resztą konta.",
  },
  campaignRoas: {
    title: "Sprawdzić kampanie z niskim ROAS",
    description:
      "Sprawdź sprzedawane produkty, wartość zamówień i marżę (zakładka Rentowność).",
  },
  concentration: {
    title: "Przeanalizować kampanię z największym kosztem",
    description: "Upewnij się, że podział budżetu odpowiada priorytetom biznesowym.",
  },
  ctr: {
    title: "Poprawić trafność reklam o niskim CTR",
    description:
      "Dopasuj nagłówki do słów kluczowych i zapytań; sprawdź, czy słowa nie są zbyt ogólne.",
  },
  conversion: {
    title: "Sprawdzić strony docelowe i ruch o niskiej konwersji",
    description:
      "Przejdź ścieżkę zakupu na stronie docelowej (także na telefonie) i sprawdź śledzenie konwersji.",
  },
  scale: {
    title: "Sprawdzić budżet i udział w wyświetleniach najlepszych elementów",
    description:
      "Jeśli „Utracony udział w wyświetleniach (budżet)” jest wysoki, zwiększaj budżet stopniowo i obserwuj CPA.",
  },
  swing: {
    title: "Sprawdzić historię zmian kampanii z wahaniami CPA",
    description: "Porównaj zmiany w kampanii z datą pogorszenia lub poprawy wyników.",
  },
  keywordWaste: {
    title: "Zweryfikować słowa kluczowe z kosztem bez konwersji",
    description:
      "Przejrzyj ich wyszukiwane hasła i dopasowania; wstrzymanie rozważ po weryfikacji.",
  },
  keywordCpa: {
    title: "Zweryfikować słowa kluczowe z wysokim CPA",
    description: "Sprawdź stawki, hasła i wartość konwersji tych słów.",
  },
  overlap: {
    title: "Uporządkować słowa kluczowe powtarzające się w kilku grupach",
    description:
      "Wybierz jedną grupę dla każdego słowa, w pozostałych dodaj je jako wykluczające.",
  },
  searchTerms: {
    title: "Sprawdzić wyszukiwane hasła i dodać wykluczenia",
    description:
      "Oznacz nietrafne hasła w zakładce „Wyszukiwane hasła” i wyeksportuj listę wykluczeń.",
  },
  newKeywords: {
    title: "Dodać nowe słowa kluczowe z wyszukiwanych haseł",
    description:
      "Dodaj hasła z konwersjami jako słowa kluczowe (najlepiej w dopasowaniu ścisłym).",
  },
  devices: {
    title: "Przeanalizować skuteczność urządzeń",
    description:
      "Sprawdź działanie strony na słabszych urządzeniach; korektę stawek rozważ po tej weryfikacji.",
  },
  locations: {
    title: "Zweryfikować lokalizacje z niską skutecznością",
    description:
      "Sprawdź ofertę i dostawę w tych lokalizacjach; korekty stawek po zebraniu danych.",
  },
  schedule: {
    title: "Przeanalizować harmonogram reklam",
    description:
      "Sprawdź, czy wzorzec godzin powtarza się w kolejnych tygodniach, zanim zmienisz harmonogram.",
  },
  ads: {
    title: "Ulepszyć reklamy z niską oceną skuteczności",
    description: "Dodaj unikalne nagłówki z głównymi słowami kluczowymi i korzyściami.",
  },
  monitor: {
    title: "Wrócić do elementów z małą ilością danych",
    description: "Nie zmieniaj ich teraz; oceń je ponownie przy kolejnym audycie.",
  },
}

const RULE_TASK: Record<string, keyof typeof T> = {
  A1: "campaignWaste",
  A2: "campaignCpa",
  A3: "campaignRoas",
  A4: "concentration",
  A6: "ctr",
  A7: "conversion",
  A8: "scale",
  A9: "swing",
  A10: "monitor",
  B0: "monitor",
  B1: "keywordWaste",
  B2: "keywordCpa",
  B3: "conversion",
  B4: "scale",
  B5: "ctr",
  B6: "overlap",
  B7: "monitor",
  B8: "scale",
  S1: "searchTerms",
  S2: "searchTerms",
  S3: "searchTerms",
  S4: "searchTerms",
  S5: "newKeywords",
  D0: "monitor",
  D1: "devices",
  D2: "devices",
  D3: "devices",
  L0: "monitor",
  L1: "locations",
  L2: "locations",
  L3: "locations",
  L4: "locations",
  H1: "schedule",
  H2: "schedule",
  G1: "ads",
  G2: "conversion",
  G3: "ctr",
}

const PRIORITY: Record<Severity, Priority> = {
  critical: "Pilny",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
  info: "Niski",
}

export function buildActionPlan(
  findings: Finding[],
  money: (v: number) => string
): Task[] {
  const groups = new Map<string, Finding[]>()
  for (const f of findings) {
    const key = RULE_TASK[f.rule]
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const tasks = [...groups].map(([key, list]) => {
    const worst = list.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] < SEVERITY_ORDER[a.severity] ? b : a
    )
    const cost = list.reduce((s, f) => s + f.cost, 0)
    const subjects = [...new Set(list.map((f) => f.subject))]
    return {
      task: {
        id: key,
        title: T[key].title,
        description: T[key].description,
        justification: `${list.length} ${list.length === 1 ? "wykrycie" : "wykryć"} (${worst.title.toLowerCase()}${list.length > 1 ? " i inne" : ""}), łączny koszt ${money(cost)}.`,
        priority: PRIORITY[worst.severity],
        subjects,
        cost,
      },
      order: SEVERITY_ORDER[worst.severity] + (key === "monitor" ? 10 : 0),
    }
  })
  return tasks
    .sort((a, b) => a.order - b.order || b.task.cost - a.task.cost)
    .map((t) => t.task)
}
