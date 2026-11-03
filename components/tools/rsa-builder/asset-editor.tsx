"use client"

import { Check, Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCopy } from "@/hooks/use-copy"
import { countChars, limitOf, RSA, type AssetKind, type Pin } from "@/lib/rsa/limits"
import type { AdAsset, Issue } from "@/lib/rsa/validate"
import { cn } from "@/lib/utils"

interface AssetEditorProps {
  kind: AssetKind
  assets: AdAsset[]
  issues: Record<string, Issue[]>
  onChange: (id: string, patch: Partial<AdAsset>) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

const LABEL: Record<AssetKind, { one: string; add: string }> = {
  headline: { one: "Nagłówek", add: "Dodaj własny nagłówek" },
  description: { one: "Tekst", add: "Dodaj własny tekst" },
}

export function AssetEditor({
  kind,
  assets,
  issues,
  onChange,
  onRemove,
  onAdd,
}: AssetEditorProps) {
  const { copy, copiedId } = useCopy()
  const rules = RSA[kind]
  const limit = limitOf(kind)

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5">
        {assets.map((asset, index) => {
          const length = countChars(asset.text)
          const over = length > limit
          const list = issues[asset.id] ?? []
          const label = `${LABEL[kind].one} ${index + 1}`
          return (
            <li key={asset.id} className="flex flex-col gap-1.5">
              {/* On phones the text gets a full line; controls wrap underneath. */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular">
                  {index + 1}
                </span>
                <div className="relative min-w-0 flex-1 basis-[calc(100%-1.75rem)] sm:basis-0">
                  <Input
                    aria-label={label}
                    aria-invalid={list.some((i) => i.severity === "error") || undefined}
                    value={asset.text}
                    onChange={(e) => onChange(asset.id, { text: e.target.value })}
                    className="pr-14"
                  />
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular",
                      over ? "font-semibold text-destructive" : "text-muted-foreground"
                    )}
                    aria-live="polite"
                  >
                    {length}/{limit}
                  </span>
                </div>
                <div className="ml-7 flex items-center gap-2 sm:ml-0">
                  <select
                    aria-label={`Przypięcie: ${label}`}
                    value={asset.pin ?? ""}
                    onChange={(e) =>
                      onChange(asset.id, {
                        pin: e.target.value ? (Number(e.target.value) as Pin) : null,
                      })
                    }
                    className={cn(
                      "h-10 w-[5.5rem] shrink-0 rounded-lg border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      asset.pin && "border-primary/60 text-[#b3a9ff]"
                    )}
                    title="Przypnij do pozycji"
                  >
                    <option value="" className="bg-popover">
                      —
                    </option>
                    {rules.positions.map((p) => (
                      <option key={p} value={p} className="bg-popover">
                        Poz. {p}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Kopiuj: ${label}`}
                    onClick={() => copy(asset.text.trim(), asset.id)}
                    disabled={!asset.text.trim()}
                  >
                    {copiedId === asset.id ? <Check /> : <Copy />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Usuń: ${label}`}
                    onClick={() => onRemove(asset.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {list.length > 0 && (
                <ul className="ml-7 flex flex-col gap-0.5">
                  {list.map((issue) => (
                    <li
                      key={issue.message}
                      className={cn(
                        "text-xs",
                        issue.severity === "error" ? "text-destructive" : "text-[#f7cf7c]"
                      )}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={assets.length >= rules.maxCount}
        >
          <Plus />
          {LABEL[kind].add}
        </Button>
        <span className="text-xs text-muted-foreground tabular">
          {assets.filter((a) => a.text.trim()).length} z {rules.maxCount}, minimum{" "}
          {rules.minCount}
        </span>
      </div>
    </div>
  )
}
