"use client"

import { useId, useRef, useState } from "react"
import { FileUp } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parseKeywordTable, type ParsedTable } from "@/lib/csv/keyword-import"
import { FileReadError, readTextFile } from "@/lib/csv/read-file"
import { formatNumber } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

const ALLOWED = ["txt", "csv", "tsv"]

export interface ImportedFile {
  name: string
  table: ParsedTable
  column: number
}

interface ListImportOptions {
  /** A .txt file: its whole content. */
  onText: (text: string) => void
  /** A CSV/TSV file, and again whenever the user picks another column. */
  onTable: (file: ImportedFile) => void
}

/** Shared file-import state for tools that take a list: read, parse, pick a column. */
export function useListImport({ onText, onTable }: ListImportOptions) {
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<ImportedFile | null>(null)

  const importFile = async (file: File) => {
    setError(null)
    try {
      const content = await readTextFile(file, ALLOWED)
      if (file.name.toLowerCase().endsWith(".txt")) {
        setImported(null)
        onText(content)
        return
      }
      const table = parseKeywordTable(content)
      const next = { name: file.name, table, column: table.keywordColumn }
      setImported(next)
      onTable(next)
    } catch (e) {
      setImported(null)
      setError(e instanceof FileReadError ? e.message : "Nie udało się odczytać pliku.")
    }
  }

  const setColumn = (column: number) => {
    if (!imported) return
    const next = { ...imported, column }
    setImported(next)
    onTable(next)
  }

  /** Hand edits detach the list from the file and its column picker. */
  const detach = () => setImported(null)

  return { importFile, imported, error, setColumn, detach }
}

type ListImport = ReturnType<typeof useListImport>

interface ListTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  hint: React.ReactNode
  listImport: ListImport
}

/** Large list input that also accepts a dropped TXT/CSV file. */
export function ListTextarea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  listImport,
}: ListTextareaProps) {
  const id = useId()
  const [dragging, setDragging] = useState(false)
  const lineCount = value.trim() ? value.trim().split(/\r?\n/).length : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
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
          if (file) void listImport.importFile(file)
        }}
      >
        <Textarea
          id={id}
          value={value}
          onChange={(e) => {
            listImport.detach()
            onChange(e.target.value)
          }}
          spellCheck={false}
          placeholder={placeholder}
          className="[field-sizing:fixed] h-64 resize-y text-sm leading-6"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-background/80 text-sm font-medium">
            Upuść plik TXT lub CSV
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

interface FileImportFieldProps {
  hint: string
  columnLabel: string
  listImport: ListImport
  /** Extra detail under the column picker, e.g. recognised metric columns. */
  detail?: React.ReactNode
}

export function FileImportField({
  hint,
  columnLabel,
  listImport,
  detail,
}: FileImportFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { imported, error } = listImport

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Import pliku</span>
      <input
        ref={fileRef}
        aria-label="Wybierz plik TXT lub CSV"
        type="file"
        accept=".txt,.csv,.tsv,text/plain,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void listImport.importFile(file)
          e.target.value = ""
        }}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <FileUp />
        Wczytaj TXT lub CSV
      </Button>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {imported && (
        <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3">
          <p className="truncate text-xs text-muted-foreground" title={imported.name}>
            {imported.name}
          </p>
          <SelectField
            label={columnLabel}
            value={String(imported.column)}
            options={imported.table.columnNames.map((name, i) => ({
              value: String(i),
              label: name || `Kolumna ${i + 1}`,
            }))}
            onChange={(value) => listImport.setColumn(Number(value))}
          />
          {detail}
        </div>
      )}
    </div>
  )
}
