"use client"

import { useState } from "react"
import { FileDown, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ExportButtonsProps {
  disabled?: boolean
  onCsv: () => void
  /** Async because the PDF engine and fonts load on demand. Omit when a PDF makes no sense. */
  onPdf?: () => Promise<void>
  /** Plain-text export, e.g. a keyword list ready to paste into Google Ads. */
  onText?: () => void
}

export function ExportButtons({ disabled, onCsv, onPdf, onText }: ExportButtonsProps) {
  const [pdfState, setPdfState] = useState<"idle" | "busy" | "error">("idle")

  const exportPdf = async () => {
    if (!onPdf) return
    setPdfState("busy")
    try {
      await onPdf()
      setPdfState("idle")
    } catch {
      setPdfState("error")
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button variant="outline" disabled={disabled} onClick={onCsv}>
          <FileSpreadsheet />
          CSV
        </Button>
        {onText && (
          <Button variant="outline" disabled={disabled} onClick={onText}>
            <FileText />
            TXT
          </Button>
        )}
        {onPdf && (
          <Button
            variant="outline"
            disabled={disabled || pdfState === "busy"}
            onClick={exportPdf}
          >
            {pdfState === "busy" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <FileDown />
            )}
            {pdfState === "busy" ? "Tworzę PDF" : "PDF"}
          </Button>
        )}
      </div>
      {pdfState === "error" && (
        <p role="alert" className="text-xs text-destructive">
          Nie udało się utworzyć PDF. Spróbuj ponownie.
        </p>
      )}
      {disabled && (
        <p className="text-xs text-muted-foreground">Eksport po wpisaniu danych.</p>
      )}
    </div>
  )
}
