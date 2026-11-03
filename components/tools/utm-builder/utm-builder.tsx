"use client"

import { useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { ExportButtons } from "@/components/export/export-buttons"
import { MobileResultBar } from "@/components/layout/mobile-result-bar"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { useSessionValue } from "@/hooks/use-session-value"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadCsv } from "@/lib/export/download"
import { utmCsvRows } from "@/lib/export/utm"
import {
  DEFAULT_NORMALIZE,
  EMPTY_UTM,
  type NormalizeOptions,
  type UtmKey,
  type UtmValues,
} from "@/lib/utm/build"
import { generateBulk, generateUtmLink, type BulkRow } from "@/lib/utm/generate"
import { addToHistory, parseHistory } from "@/lib/utm/history"
import { UTM_TEMPLATES } from "@/lib/utm/templates"
import { BulkResults } from "./bulk-results"
import { UtmForm, type UtmMode } from "./utm-form"
import { UtmHistory } from "./utm-history"
import { UtmResult } from "./utm-result"

const HISTORY_KEY = "ads-toolkit.utm-history.v1"
const RESULT_ID = "gotowy-link"

export function UtmBuilder() {
  const [mode, setMode] = useState<UtmMode>("single")
  const [url, setUrl] = useState("")
  const [bulkText, setBulkText] = useState("")
  const [values, setValues] = useState<UtmValues>(EMPTY_UTM)
  const [normalize, setNormalize] = useState<NormalizeOptions>(DEFAULT_NORMALIZE)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const [rawHistory, writeHistory] = useSessionValue(HISTORY_KEY)
  const history = useMemo(() => parseHistory(rawHistory ?? null), [rawHistory])

  const generation = useMemo(
    () => generateUtmLink(url, values, normalize),
    [url, values, normalize]
  )
  const bulkRows = useMemo(
    () => (mode === "bulk" ? generateBulk(bulkText, values, normalize) : []),
    [mode, bulkText, values, normalize]
  )

  // Errors appear once the user has started, not on an empty form.
  const started = Object.values(values).some((v) => v.trim() !== "")
  const urlError = !generation.ok && url.trim() ? generation.urlError : null
  const fieldErrors =
    !generation.ok && (started || url.trim()) ? generation.fieldErrors : {}

  const save = (items: Parameters<typeof addToHistory>[1]) =>
    writeHistory(JSON.stringify(addToHistory(history, items)))

  const applyTemplate = (id: string) => {
    const template = UTM_TEMPLATES.find((t) => t.id === id)
    if (!template) return
    setTemplateId(id)
    setValues((v) => ({ ...v, ...template.values }))
  }

  const reset = () => {
    setUrl("")
    setBulkText("")
    setValues(EMPTY_UTM)
    setTemplateId(null)
    setNormalize(DEFAULT_NORMALIZE)
  }

  const exportCsv = () =>
    downloadCsv(toCsv(utmCsvRows(history)), datedFilename("linki-utm", "csv"))

  const bulkFieldErrors = bulkRows.some(
    (r) => !r.result.ok && Object.keys(r.result.fieldErrors).length > 0
  )

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["utm-builder"]}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons disabled={history.length === 0} onCsv={exportCsv} />
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-6">
        <Panel title="Parametry linku">
          <UtmForm
            mode={mode}
            onModeChange={setMode}
            url={url}
            onUrlChange={setUrl}
            bulkText={bulkText}
            onBulkTextChange={setBulkText}
            urlError={urlError}
            values={values}
            onValueChange={(key: UtmKey, value: string) =>
              setValues((v) => ({ ...v, [key]: value }))
            }
            fieldErrors={fieldErrors}
            templateId={templateId}
            onTemplate={applyTemplate}
            normalize={normalize}
            onNormalizeChange={(patch) => setNormalize((n) => ({ ...n, ...patch }))}
          />
        </Panel>

        <div id={RESULT_ID} className="flex min-w-0 scroll-mt-20 flex-col gap-5">
          <Panel title={mode === "single" ? "Gotowy link" : "Gotowe linki"}>
            {mode === "single" ? (
              <UtmResult
                generation={generation.ok ? generation : null}
                onCopied={() =>
                  generation.ok &&
                  save([
                    {
                      target: url.trim(),
                      url: generation.link.url,
                      values: generation.link.values,
                    },
                  ])
                }
              />
            ) : (
              <BulkResults
                rows={bulkRows}
                hasFieldErrors={bulkFieldErrors}
                onCopiedAll={(rows: BulkRow[]) =>
                  save(
                    rows.flatMap((r) =>
                      r.result.ok
                        ? [
                            {
                              target: r.input,
                              url: r.result.link.url,
                              values: r.result.link.values,
                            },
                          ]
                        : []
                    )
                  )
                }
              />
            )}
          </Panel>

          <Panel
            title="Historia z tej sesji"
            description="Eksport CSV zapisuje wszystkie linki z historii."
          >
            <UtmHistory
              items={history}
              onRemove={(id) =>
                writeHistory(JSON.stringify(history.filter((h) => h.id !== id)))
              }
              onClear={() => writeHistory(null)}
            />
          </Panel>
        </div>
      </div>

      <MobileResultBar
        label="Link gotowy"
        value={
          mode === "single" && generation.ok ? generation.link.values.utm_campaign : null
        }
        targetId={RESULT_ID}
      />
    </>
  )
}
