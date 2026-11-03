"use client"

import { useId, useRef, useState } from "react"
import { FileUp, LoaderCircle, ScanSearch } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SEPARATOR_OPTIONS } from "@/constants/keyword-analyzer"
import { MAX_KEYWORDS, type Separator } from "@/lib/calculations/keyword-analyzer"
import {
  keywordColumnValues,
  parseKeywordTable,
  type ParsedTable,
} from "@/lib/csv/keyword-import"
import { FileReadError, readTextFile } from "@/lib/csv/read-file"
import { formatNumber } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

interface KeywordInputProps {
  text: string
  onTextChange: (text: string) => void
  separator: Separator
  onSeparatorChange: (separator: Separator) => void
  brands: string
  onBrandsChange: (brands: string) => void
  onAnalyze: () => void
  busy: boolean
  /** True when the list changed since the last analysis. */
  stale: boolean
}

export function KeywordInput(props: KeywordInputProps) {
  const { text, onTextChange, separator, onSeparatorChange, brands, onBrandsChange } =
    props
  const textId = useId()
  const brandsId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [imported, setImported] = useState<{ name: string; table: ParsedTable } | null>(
    null
  )

  const lineCount = text.trim() ? text.trim().split(/\r?\n/).length : 0

  const loadColumn = (table: ParsedTable, column: number) => {
    onTextChange(keywordColumnValues(table, column).join("\n"))
    onSeparatorChange("newline")
  }

  const importFile = async (file: File) => {
    setImportError(null)
    try {
      const content = await readTextFile(file, ["txt", "csv", "tsv"])
      if (file.name.toLowerCase().endsWith(".txt")) {
        setImported(null)
        onTextChange(content)
        return
      }
      const table = parseKeywordTable(content)
      setImported({ name: file.name, table })
      loadColumn(table, table.keywordColumn)
    } catch (error) {
      setImported(null)
      setImportError(
        error instanceof FileReadError ? error.message : "Nie udało się odczytać pliku."
      )
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor={textId} className="text-sm font-medium">
            Lista słów kluczowych
          </Label>
          <span className="text-xs text-muted-foreground tabular">
            {formatNumber(lineCount)} {lineCount === 1 ? "wiersz" : "wierszy"}
          </span>
        </div>
        <div
          className={cn("relative rounded-lg", dragging && "ring-2 ring-primary")}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) void importFile(file)
          }}
        >
          <Textarea
            id={textId}
            value={text}
            onChange={(e) => {
              // Hand edits detach the list from the imported file's column picker.
              setImported(null)
              onTextChange(e.target.value)
            }}
            spellCheck={false}
            placeholder={
              "Wklej frazy, po jednej w wierszu:\nbuty do biegania damskie\ntanie buty do biegania\njak wybrać buty do biegania"
            }
            className="[field-sizing:fixed] h-64 resize-y text-sm leading-6"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-background/80 text-sm font-medium">
              Upuść plik TXT lub CSV
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Do {formatNumber(MAX_KEYWORDS)} fraz. Wiersze skopiowane z arkusza: bierzemy
          pierwszą kolumnę. Plik możesz też przeciągnąć na pole.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Import pliku</span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.tsv,text/plain,text/csv"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              e.target.value = ""
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp />
            Wczytaj TXT lub CSV
          </Button>
          <p className="text-xs text-muted-foreground">
            Eksport z Planera słów kluczowych lub raport Google Ads, do 5 MB. Plik zostaje
            na Twoim komputerze.
          </p>
          {importError && (
            <p role="alert" className="text-xs text-destructive">
              {importError}
            </p>
          )}
          {imported && (
            <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3">
              <p className="truncate text-xs text-muted-foreground" title={imported.name}>
                {imported.name}
              </p>
              <SelectField
                label="Kolumna ze słowami kluczowymi"
                value={String(imported.table.keywordColumn)}
                options={imported.table.columnNames.map((name, i) => ({
                  value: String(i),
                  label: name || `Kolumna ${i + 1}`,
                }))}
                onChange={(value) => {
                  const table = { ...imported.table, keywordColumn: Number(value) }
                  setImported({ ...imported, table })
                  loadColumn(table, table.keywordColumn)
                }}
              />
            </div>
          )}
        </div>

        <SelectField
          label="Rozdzielanie fraz"
          value={separator}
          onChange={onSeparatorChange}
          options={SEPARATOR_OPTIONS}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={brandsId} className="text-sm font-medium">
            Marki <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
          </Label>
          <Input
            id={brandsId}
            value={brands}
            onChange={(e) => onBrandsChange(e.target.value)}
            placeholder="np. Nike, Adidas, Twoja marka"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Oddziel przecinkami. Bez tej listy narzędzie nie rozpozna marek.
          </p>
        </div>

        <Button size="lg" onClick={props.onAnalyze} disabled={!text.trim() || props.busy}>
          {props.busy ? <LoaderCircle className="animate-spin" /> : <ScanSearch />}
          {props.busy
            ? "Analizuję"
            : props.stale
              ? "Analizuj ponownie"
              : "Analizuj listę"}
        </Button>
      </div>
    </div>
  )
}
