"use client"

import { useRef, useState } from "react"
import { Download, FileText, ImageUp, LoaderCircle, Trash2 } from "lucide-react"
import { TextField } from "@/components/forms/text-field"
import { Panel } from "@/components/layout/panel"
import { Button } from "@/components/ui/button"
import type { Task, TaskStatus } from "@/lib/auditor/action-plan"
import type { AuditResult } from "@/lib/auditor/audit"
import { campaignsCsv, findingsCsv } from "@/lib/auditor/export"
import type { AuditDataset } from "@/lib/auditor/join"
import type { ProfitModel } from "@/lib/auditor/profitability"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { availableSections, SECTIONS, type SectionId } from "@/lib/pdf/audit-report"
import { readLogo } from "@/lib/pdf/logo"
import { stripDiacritics } from "@/lib/keywords/normalize"
import type { ReportLogo } from "@/lib/reports/model"

/** "Biegam.pl Sp. z o.o." → "biegam-pl-sp-z-o-o" for the file name. */
const slug = (v: string) =>
  stripDiacritics(v.toLocaleLowerCase("pl-PL"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)

/** Spec section 10: report settings, section choice and the PDF / CSV exports. */
export function ReportPanel({
  data,
  result,
  tasks,
  statuses,
  profit,
}: {
  data: AuditDataset
  result: AuditResult
  tasks: Task[]
  statuses: Record<string, TaskStatus>
  profit: ProfitModel
}) {
  const [client, setClient] = useState("")
  const [account, setAccount] = useState("")
  const [logo, setLogo] = useState<ReportLogo | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [hidden, setHidden] = useState<SectionId[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const available = availableSections({ data, result, tasks })

  const pdf = async () => {
    setBusy(true)
    setError(null)
    try {
      // The renderer and jsPDF load only when a report is requested.
      const { renderAuditReport } = await import("@/lib/pdf/audit-report")
      const blob = await renderAuditReport({
        client,
        account,
        logo,
        hidden,
        data,
        result,
        tasks,
        statuses,
        profit: profit.ready ? profit : null,
        generatedAt: new Date(),
      })
      downloadBlob(
        blob,
        datedFilename(`audyt-google-ads${client ? `-${slug(client)}` : ""}`, "pdf")
      )
    } catch {
      setError("Nie udało się przygotować PDF. Spróbuj ponownie.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Raport PDF"
        description="Raport dla klienta lub do własnej pracy. Rozdziały bez danych są pomijane automatycznie."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label="Nazwa firmy lub klienta"
            value={client}
            onChange={setClient}
            placeholder="np. Biegam.pl"
          />
          <TextField
            label="Nazwa konta Google Ads"
            value={account}
            onChange={setAccount}
            placeholder="np. Biegam – sklep"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Wybierz logo do raportu"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file) return
              try {
                setLogo(await readLogo(file))
                setLogoError(null)
              } catch (err) {
                setLogoError(
                  err instanceof Error ? err.message : "Nie udało się wczytać logo."
                )
              }
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageUp />
            {logo ? "Zmień logo" : "Dodaj logo (opcjonalnie)"}
          </Button>
          {logo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img
                src={logo.dataUrl}
                alt="Logo w raporcie"
                className="h-9 max-w-32 rounded bg-white object-contain p-1"
              />
              <Button variant="ghost" size="sm" onClick={() => setLogo(null)}>
                <Trash2 />
                Usuń logo
              </Button>
            </>
          )}
          {logoError && (
            <p role="alert" className="text-sm text-destructive">
              {logoError}
            </p>
          )}
        </div>

        <fieldset className="mt-6">
          <legend className="mb-3 text-sm font-semibold">Rozdziały raportu</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const has = available.includes(s.id)
              const id = `section-${s.id}`
              return (
                <label
                  key={s.id}
                  htmlFor={id}
                  className={
                    has
                      ? "flex min-h-6 items-center gap-2.5 text-sm"
                      : "flex min-h-6 items-center gap-2.5 text-sm text-muted-foreground"
                  }
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={has && !hidden.includes(s.id)}
                    disabled={!has}
                    onChange={(e) => {
                      const on = e.target.checked
                      setHidden((h) => (on ? h.filter((x) => x !== s.id) : [...h, s.id]))
                    }}
                    className="size-5 shrink-0 accent-(--tool)"
                  />
                  {s.label}
                  {!has && <span className="text-xs">(brak danych)</span>}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={pdf} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <FileText />}
            Pobierz raport PDF
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <Panel
        title="Eksport danych CSV"
        description="Pliki z separatorem „;” i przecinkiem dziesiętnym (Excel PL). Teksty są zabezpieczone przed formułami."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                findingsCsv(result.findings),
                datedFilename("audyt-rekomendacje", "csv")
              )
            }
          >
            <Download />
            Wykrycia i rekomendacje
          </Button>
          <Button
            variant="outline"
            disabled={!data.campaigns.some((c) => c.primary)}
            onClick={() =>
              downloadCsv(campaignsCsv(data), datedFilename("audyt-kampanie", "csv"))
            }
          >
            <Download />
            Dane kampanii
          </Button>
        </div>
      </Panel>
    </div>
  )
}
