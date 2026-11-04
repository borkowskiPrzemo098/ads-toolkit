"use client"

import { useCallback, useMemo, useState } from "react"
import type { Mapping } from "@/lib/auditor/columns"
import type { ReportType } from "@/lib/auditor/detect"
import {
  analyzeReport,
  blockingIssues,
  findHeaderRow,
  headerSignature,
  sameContent,
  type AnalysisOptions,
  type ReportAnalysis,
} from "@/lib/auditor/import"
import { ImportError, type SheetTable } from "@/lib/auditor/parse"
import { readReportFile } from "@/lib/auditor/parse-client"

export interface ImportedFile {
  id: string
  name: string
  size: number
  status: "parsing" | "ready" | "error"
  error?: string
  table?: SheetTable
  /** User overrides; undefined = automatic. */
  mapping?: Mapping
  type?: ReportType | null
  skipDuplicates: boolean
}

export interface FileView extends ImportedFile {
  analysis?: ReportAnalysis
  /** Another file in the audit with identical content. */
  duplicateOf?: string
}

const ACCEPTED = /\.(csv|tsv|txt|xlsx)$/i
let counter = 0

/**
 * Import state for one audit, kept in memory only. Column mappings the user sets are
 * remembered by header signature, so another export with the same columns reuses them.
 */
export function useAuditImport() {
  const [files, setFiles] = useState<ImportedFile[]>([])
  const [mappingMemory, setMappingMemory] = useState<Record<string, Mapping>>({})

  const patch = (id: string, change: Partial<ImportedFile>) =>
    setFiles((all) => all.map((f) => (f.id === id ? { ...f, ...change } : f)))

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = [...list]
    for (const file of incoming) {
      const id = `r${++counter}`
      if (!ACCEPTED.test(file.name)) {
        setFiles((all) => [
          ...all,
          {
            id,
            name: file.name,
            size: file.size,
            status: "error",
            error:
              "Nieobsługiwany format. Wczytaj raport CSV, TSV lub XLSX z Google Ads.",
            skipDuplicates: false,
          },
        ])
        continue
      }
      setFiles((all) => [
        ...all,
        {
          id,
          name: file.name,
          size: file.size,
          status: "parsing",
          skipDuplicates: false,
        },
      ])
      readReportFile(file)
        .then((table) => patch(id, { status: "ready", table }))
        .catch((error: unknown) =>
          patch(id, {
            status: "error",
            error:
              error instanceof ImportError
                ? error.message
                : "Nie udało się odczytać pliku.",
          })
        )
    }
  }, [])

  const removeFile = (id: string) => setFiles((all) => all.filter((f) => f.id !== id))

  const views: FileView[] = useMemo(() => {
    return files.map((file, index) => {
      if (!file.table) return file
      const remembered = mappingMemory[headerSignatureOf(file.table)]
      const analysis = cachedAnalysis(file.table, {
        mapping: file.mapping ?? remembered,
        type: file.type,
        fileName: file.name,
      })
      const earlier = files
        .slice(0, index)
        .find((other) => other.table && sameContent(other.table, file.table!))
      return { ...file, analysis, duplicateOf: earlier?.name }
    })
  }, [files, mappingMemory])

  const setMapping = (id: string, mapping: Mapping) => {
    const file = files.find((f) => f.id === id)
    patch(id, { mapping })
    if (file?.table)
      setMappingMemory((memory) => ({
        ...memory,
        [headerSignatureOf(file.table!)]: mapping,
      }))
  }

  // Stable between renders, so the dataset built from it is not rebuilt on every render.
  const ready = useMemo(
    () => views.filter((v) => v.status === "ready" && v.analysis),
    [views]
  )
  const canConfirm =
    ready.length > 0 &&
    views.every((v) => v.status !== "parsing") &&
    ready.every((v) => blockingIssues(v.analysis!).length === 0 && !v.duplicateOf)

  return {
    files: views,
    ready,
    canConfirm,
    addFiles,
    removeFile,
    setMapping,
    setType: (id: string, type: ReportType | null) => patch(id, { type }),
    setSkipDuplicates: (id: string, skipDuplicates: boolean) =>
      patch(id, { skipDuplicates }),
    resetMapping: (id: string) => {
      const file = files.find((f) => f.id === id)
      patch(id, { mapping: undefined })
      if (file?.table) {
        const signature = headerSignatureOf(file.table)
        setMappingMemory((memory) =>
          Object.fromEntries(Object.entries(memory).filter(([key]) => key !== signature))
        )
      }
    },
    clear: () => {
      setFiles([])
      setMappingMemory({})
    },
  }
}

/**
 * Analysis per table and settings: changing one file (or a duplicate toggle) must not
 * re-analyse 300k rows of the others.
 */
const analysisCache = new WeakMap<SheetTable, Map<string, ReportAnalysis>>()
function cachedAnalysis(table: SheetTable, options: AnalysisOptions): ReportAnalysis {
  const key = JSON.stringify([
    options.mapping ?? null,
    options.type === undefined ? "auto" : options.type,
    options.fileName,
  ])
  const forTable = analysisCache.get(table) ?? new Map<string, ReportAnalysis>()
  analysisCache.set(table, forTable)
  const hit = forTable.get(key)
  if (hit) return hit
  const analysis = analyzeReport(table, options)
  forTable.set(key, analysis)
  return analysis
}

function headerSignatureOf(table: SheetTable): string {
  const row = findHeaderRow(table.rows)
  return row === null ? "" : headerSignature(table.rows[row])
}
