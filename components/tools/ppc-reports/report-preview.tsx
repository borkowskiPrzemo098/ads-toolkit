"use client"

import { MetricBarChart } from "@/components/charts/lazy"
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/formatting/number"
import { changeTone, formatChange, formatKpi } from "@/lib/reports/format"
import {
  CHART_TITLE,
  chartSeries,
  kpiLines,
  type ChartMetric,
  type ReportModel,
} from "@/lib/reports/model"
import { cn } from "@/lib/utils"

const CHARTS: ChartMetric[] = ["cost", "clicks", "conversions", "roas"]

/** The report as the client will read it: light paper, same content and order as the PDF. */
export function ReportPreview({ model }: { model: ReportModel }) {
  const { settings, texts } = model
  const currency = settings.currency
  const charts = CHARTS.map((metric) => ({
    metric,
    series: chartSeries(model, metric),
  })).filter((c) => c.series)
  const sections: [string, string[]][] = [
    ["Najważniejsze obserwacje", texts.observations],
    ["Wnioski", texts.conclusions],
    ["Rekomendacje na kolejny okres", texts.recommendations],
  ]

  return (
    <article
      className="rounded-xl bg-white p-6 text-[#14171e] shadow-[0_1px_2px_rgb(0_0_0/0.3),0_12px_32px_-12px_rgb(0_0_0/0.6)] sm:p-10"
      aria-label="Podgląd raportu"
    >
      <header className="border-b border-[#e2e5eb] pb-6">
        {settings.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img
            src={settings.logo.dataUrl}
            alt={settings.agencyName || "Logo agencji"}
            className="mb-6 h-10 max-w-40 object-contain object-left"
          />
        ) : settings.agencyName ? (
          <p className="mb-6 text-sm font-semibold">{settings.agencyName}</p>
        ) : null}
        <div className="mb-4 h-1 w-10 rounded-full bg-[#7c6cff]" />
        <p className="text-sm text-[#626a7a]">Raport kampanii Google Ads</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {settings.clientName || "Nazwa klienta"}
        </h2>
        {settings.campaignName && (
          <p className="mt-1 text-[0.9375rem]">{settings.campaignName}</p>
        )}
        <p className="mt-3 text-sm text-[#626a7a]">
          {settings.periodLabel
            ? `Okres: ${settings.periodLabel}`
            : "Okres do uzupełnienia"}
          {model.previous &&
            settings.comparisonLabel &&
            ` · porównanie z: ${settings.comparisonLabel}`}
        </p>
      </header>

      <section className="py-6">
        <h3 className="mb-2 text-base font-semibold">Podsumowanie</h3>
        <p className="text-sm leading-relaxed">{texts.summary}</p>
      </section>

      <section className="border-t border-[#e2e5eb] py-6">
        <h3 className="mb-4 text-base font-semibold">Kluczowe wskaźniki</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpiLines(model).map((line) => {
            const tone = changeTone(line)
            return (
              <div key={line.key} className="rounded-lg bg-[#f4f5f8] px-3.5 py-3">
                <dt className="text-xs text-[#626a7a]">{line.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular">
                  {formatKpi(line, line.value!, currency)}
                </dd>
                {line.change !== null && (
                  <dd
                    className={cn(
                      "text-xs tabular",
                      tone === "good" && "text-[#16805a]",
                      tone === "bad" && "text-[#be3434]",
                      tone === "neutral" && "text-[#626a7a]"
                    )}
                  >
                    {formatChange(line.change)} vs poprzedni okres
                  </dd>
                )}
              </div>
            )
          })}
        </dl>
      </section>

      {charts.length > 0 && (
        <section className="border-t border-[#e2e5eb] py-6">
          <h3 className="mb-4 text-base font-semibold">Wykresy</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {charts.map(({ metric, series }) => (
              <MetricBarChart
                key={metric}
                title={CHART_TITLE[metric]}
                series={series!}
                format={(v) =>
                  metric === "cost"
                    ? formatCurrency(v, currency)
                    : metric === "roas"
                      ? formatPercent(v, 0)
                      : formatNumber(v, v % 1 ? 1 : 0)
                }
                compact={(v) =>
                  metric === "cost"
                    ? formatCompactCurrency(v, currency)
                    : metric === "roas"
                      ? formatPercent(v, 0)
                      : formatNumber(v)
                }
              />
            ))}
          </div>
          {charts[0].series!.mode === "periods" && (
            <p className="mt-2 text-xs text-[#626a7a]">
              Bez danych dziennych wykresy porównują dwa okresy.
            </p>
          )}
        </section>
      )}

      {sections.map(([title, items]) => {
        const clean = items.map((s) => s.trim()).filter(Boolean)
        if (!clean.length) return null
        return (
          <section key={title} className="border-t border-[#e2e5eb] py-6">
            <h3 className="mb-3 text-base font-semibold">{title}</h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed marker:text-[#7c6cff]">
              {clean.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )
      })}

      {model.current.campaigns && model.current.campaigns.length > 1 && (
        <section className="border-t border-[#e2e5eb] pt-6">
          <h3 className="mb-3 text-base font-semibold">Kampanie</h3>
          <div className="relative -mx-6 overflow-x-auto px-6 sm:-mx-10 sm:px-10">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-[#e2e5eb] text-xs text-[#626a7a]">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">
                    Kampania
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Koszt
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Kliknięcia
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Konwersje
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    CPA
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    ROAS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f4]">
                {model.current.campaigns.map((c) => (
                  <tr key={c.key}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {c.key}
                    </th>
                    <td className="py-2 pr-3 text-right tabular">
                      {c.totals.cost === null
                        ? "—"
                        : formatCurrency(c.totals.cost, currency)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">
                      {c.totals.clicks === null ? "—" : formatNumber(c.totals.clicks)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">
                      {c.totals.conversions === null
                        ? "—"
                        : formatNumber(
                            c.totals.conversions,
                            c.totals.conversions % 1 ? 1 : 0
                          )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">
                      {c.kpis.cpa.ok ? formatCurrency(c.kpis.cpa.value, currency) : "—"}
                    </td>
                    <td className="py-2 text-right tabular">
                      {c.kpis.roas.ok ? formatPercent(c.kpis.roas.value, 0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </article>
  )
}
