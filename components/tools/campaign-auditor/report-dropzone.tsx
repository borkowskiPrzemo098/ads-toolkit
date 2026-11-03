"use client"

import { useRef, useState } from "react"
import { FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Drop or pick several Google Ads exports at once. Files are read in the browser only. */
export function ReportDropzone({
  onFiles,
  compact,
}: {
  onFiles: (files: FileList | File[]) => void
  /** Smaller variant once some reports are already in. */
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center transition-[border-color,background-color,box-shadow] duration-200 ease-out-quart",
        compact ? "px-5 py-5 sm:flex-row sm:justify-between sm:text-left" : "px-6 py-12",
        over
          ? "border-(--tool) bg-[color-mix(in_oklab,var(--tool)_8%,transparent)] shadow-[0_0_40px_-12px_var(--tool)]"
          : "border-[#334055] bg-background/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Wybierz raporty Google Ads (CSV lub XLSX)"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ""
        }}
      />
      {compact ? (
        <>
          <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <FileSpreadsheet
              className="size-5 shrink-0 text-(--tool)"
              aria-hidden="true"
            />
            Upuść kolejne raporty albo
          </p>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload />
            Dodaj raporty
          </Button>
        </>
      ) : (
        <>
          <span className="grid size-14 place-items-center rounded-2xl bg-(--tool) text-[#0b0d12] glow">
            <Upload className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Przeciągnij tutaj raporty z Google Ads
            </p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              Kampanie, grupy reklam, słowa kluczowe, wyszukiwane hasła, reklamy,
              urządzenia, lokalizacje, godziny, strony docelowe, konwersje. CSV lub XLSX,
              do 50 MB na plik.
            </p>
          </div>
          <Button size="lg" onClick={() => inputRef.current?.click()}>
            <Upload />
            Wybierz pliki
          </Button>
        </>
      )}
    </div>
  )
}
