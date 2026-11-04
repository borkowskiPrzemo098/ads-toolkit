"use client"

import { NumberField } from "@/components/forms/number-field"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { formatMoney } from "@/lib/auditor/format"
import {
  ORIGIN_LABEL,
  type Line,
  type Origin,
  type ProfitModel,
} from "@/lib/auditor/profitability"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import type { CalcResult } from "@/types/calculation"

export interface ProfitForm {
  aov: string
  marginPct: string
  productCost: string
  shippingCost: string
  otherCost: string
  targetProfit: string
}

const ORIGIN_STYLE: Record<Origin, string> = {
  google: "bg-[#36d6ff]/12 text-[#7fe3fb] ring-[#36d6ff]/30",
  manual: "bg-[#c17bff]/14 text-[#d6aaff] ring-[#c17bff]/35",
  estimate: "bg-warning/12 text-warning ring-warning/30",
}

function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        ORIGIN_STYLE[origin]
      )}
    >
      {ORIGIN_LABEL[origin]}
    </span>
  )
}

/** Spec section 6: optional margin inputs; Google Ads data, typed values and estimates kept apart. */
export function ProfitabilityPanel({
  model,
  form,
  onForm,
  currency,
  hasValue,
}: {
  model: ProfitModel
  form: ProfitForm
  onForm: (f: ProfitForm) => void
  currency: string | null
  hasValue: boolean
}) {
  const money = (v: number) => formatMoney(v, currency)
  const show = (r: CalcResult, kind: Line["kind"]) =>
    !r.ok
      ? "—"
      : kind === "money"
        ? money(r.value)
        : kind === "percent"
          ? formatPercent(r.value, 1)
          : formatNumber(r.value, r.value % 1 ? 1 : 0)
  const set = (k: keyof ProfitForm) => (v: string) => onForm({ ...form, [k]: v })

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Twoje dane o marży i kosztach"
        description="Opcjonalnie. Bez marży lub kosztu produktu nie pokazujemy zysku. Wartości wpisane są oznaczone osobno od danych z Google Ads."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Marża"
            suffix="%"
            value={form.marginPct}
            onChange={set("marginPct")}
            optional
            hint="Marża brutto od przychodu."
          />
          <NumberField
            label="Koszt produktu na zamówienie"
            value={form.productCost}
            onChange={set("productCost")}
            optional
            hint="Zamiast marży, jeśli wolisz."
          />
          <NumberField
            label="Koszt dostawy na zamówienie"
            value={form.shippingCost}
            onChange={set("shippingCost")}
            optional
          />
          <NumberField
            label="Inne koszty zmienne na zamówienie"
            value={form.otherCost}
            onChange={set("otherCost")}
            optional
            hint="Np. prowizje, pakowanie."
          />
          <NumberField
            label="Średnia wartość zamówienia"
            value={form.aov}
            onChange={set("aov")}
            optional
            hint={
              hasValue
                ? "Raporty mają wartość konwersji, więc to pole nie jest potrzebne."
                : "Raporty nie mają wartości konwersji: przychód oszacujemy z tej kwoty."
            }
          />
          <NumberField
            label="Docelowy zysk w okresie"
            value={form.targetProfit}
            onChange={set("targetProfit")}
            optional
          />
        </div>
      </Panel>

      {model.missing.length > 0 && (
        <p
          role="status"
          className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-[#f7cf7c]"
        >
          {model.missing.join(" ")}
        </p>
      )}

      <Panel
        title="Wynik"
        description="Szacunki opierają się na Twoich założeniach i danych z okresu raportu. To nie jest prognoza."
      >
        <dl className="flex flex-col">
          {model.lines.map((l) => (
            <div
              key={l.label}
              className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <dt className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {l.label}
                  <OriginBadge origin={l.origin} />
                </span>
                {l.hint && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {l.hint}
                  </span>
                )}
                {!l.value.ok && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {l.value.reason}
                  </span>
                )}
              </dt>
              <dd
                className={cn(
                  "shrink-0 text-lg font-semibold tabular",
                  l.label.startsWith("Szacowany zysk") &&
                    l.value.ok &&
                    (l.value.value >= 0
                      ? "text-success neon-text"
                      : "text-destructive neon-text")
                )}
              >
                {show(l.value, l.kind)}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {model.ready && model.campaigns.length > 0 && (
        <Panel
          title="Zysk według kampanii"
          description="Te same założenia dla każdej kampanii. Kampanie mogą mieć w rzeczywistości różne marże."
        >
          <TableScroll label="Szacowany zysk według kampanii">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Kampania</th>
                  <th className="px-3 py-2 text-right font-medium">Przychód</th>
                  <th className="px-3 py-2 text-right font-medium">ROAS</th>
                  <th className="py-2 pl-3 text-right font-medium">Szacowany zysk</th>
                </tr>
              </thead>
              <tbody>
                {model.campaigns.map((c) => (
                  <tr key={c.name} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {show(c.revenue, "money")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {show(c.roas, "percent")}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pl-3 text-right font-semibold whitespace-nowrap tabular",
                        c.profit.ok &&
                          (c.profit.value >= 0 ? "text-success" : "text-destructive")
                      )}
                    >
                      {show(c.profit, "money")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}
    </div>
  )
}
