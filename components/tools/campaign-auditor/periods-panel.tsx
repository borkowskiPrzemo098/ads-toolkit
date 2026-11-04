"use client"

import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { formatMoney } from "@/lib/auditor/format"
import type { AuditDataset } from "@/lib/auditor/join"
import {
  compare,
  comparisonOptions,
  type CampaignChange,
  type MetricRow,
} from "@/lib/auditor/periods"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

/** Spec section 9: previous vs current period, normalised per day when lengths differ. */
export function PeriodsPanel({ data }: { data: AuditDataset }) {
  const options = useMemo(() => comparisonOptions(data), [data])
  const [id, setId] = useState(options[0]?.id ?? "")
  const result = useMemo(() => (id ? compare(data, id) : null), [data, id])
  const money = (v: number) => formatMoney(v, data.currency)

  if (!options.length)
    return (
      <Panel title="Porównanie okresów">
        <p className="text-sm text-muted-foreground">
          Porównanie wymaga dwóch raportów tego samego typu z różnych okresów albo raportu
          dziennego obejmującego co najmniej 14 dni.
        </p>
      </Panel>
    )

  const fmt = (r: MetricRow, v: number | null) =>
    v === null
      ? "N/D"
      : r.kind === "money"
        ? money(v)
        : r.kind === "percent"
          ? formatPercent(v, r.key === "ctr" ? 2 : 0)
          : formatNumber(v, v % 1 ? 1 : 0)

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Porównanie okresów">
        <SelectField
          label="Co porównać"
          value={id}
          onChange={setId}
          options={options.map((o) => ({ value: o.id, label: o.label }))}
        />
        {result && (
          <p className="mt-3 text-sm text-muted-foreground">
            Poprzedni:{" "}
            <span className="text-foreground tabular">{result.previous.label}</span> (
            {result.previous.window.days} dni) · bieżący:{" "}
            <span className="text-foreground tabular">{result.current.label}</span> (
            {result.current.window.days} dni)
          </p>
        )}
      </Panel>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-[#f7cf7c]"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <Panel title="Wskaźniki">
            <TableScroll label="Porównanie wskaźników między okresami">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Wskaźnik</th>
                    <th className="px-3 py-2 text-right font-medium">Poprzedni</th>
                    <th className="px-3 py-2 text-right font-medium">Bieżący</th>
                    <th className="px-3 py-2 text-right font-medium">Zmiana</th>
                    <th className="py-2 pl-3 text-right font-medium">Zmiana %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const Icon =
                      r.change === null || r.change === 0
                        ? Minus
                        : r.change > 0
                          ? ArrowUpRight
                          : ArrowDownRight
                    const tone =
                      r.good === null
                        ? "text-[#c9cfdb]"
                        : r.good
                          ? "text-success"
                          : "text-destructive"
                    return (
                      <tr key={r.key} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium">
                          {r.label}
                          {r.perDay && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              dziennie
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                          {fmt(r, r.previous)}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                          {fmt(r, r.current)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right whitespace-nowrap tabular",
                            tone
                          )}
                        >
                          {r.change === null
                            ? "—"
                            : `${r.change > 0 ? "+" : ""}${r.kind === "percent" ? `${formatNumber(r.change, r.key === "ctr" ? 2 : 0)} p.p.` : fmt(r, r.change)}`}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 pl-3 text-right whitespace-nowrap tabular",
                            tone
                          )}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            <Icon
                              className="size-4"
                              aria-label={
                                r.change === null || r.change === 0
                                  ? "bez zmian"
                                  : r.change > 0
                                    ? "wzrost"
                                    : "spadek"
                              }
                            />
                            {r.changePct === null
                              ? "—"
                              : `${r.changePct > 0 ? "+" : ""}${formatPercent(r.changePct * 100, 1)}`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
            <p className="mt-3 text-xs text-muted-foreground">
              Zielony = zmiana korzystna (np. niższy CPA), czerwony = niekorzystna. Zmiana
              kosztu jest neutralna.
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChangeList
              title="Kampanie, które najbardziej poprawiły wyniki"
              items={result.improved}
              money={money}
              good
            />
            <ChangeList
              title="Kampanie, które najbardziej pogorszyły wyniki"
              items={result.worsened}
              money={money}
            />
          </div>
        </>
      )}
    </div>
  )
}

function ChangeList({
  title,
  items,
  money,
  good,
}: {
  title: string
  items: CampaignChange[]
  money: (v: number) => string
  good?: boolean
}) {
  return (
    <Panel
      title={title}
      description="Kampanie z co najmniej 5 konwersjami w obu okresach; ROAS, gdy raport ma wartość konwersji, inaczej CPA."
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Brak kampanii spełniających ten warunek.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <li
              key={c.name}
              className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-3"
            >
              <span className="font-medium">{c.name}</span>
              <span className="tabular">
                {c.metric}{" "}
                {c.metric === "CPA" ? money(c.previous) : formatPercent(c.previous, 0)} →{" "}
                {c.metric === "CPA" ? money(c.current) : formatPercent(c.current, 0)}{" "}
                <span className={good ? "text-success" : "text-destructive"}>
                  ({c.changePct > 0 ? "+" : ""}
                  {formatPercent(c.changePct * 100, 0)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
