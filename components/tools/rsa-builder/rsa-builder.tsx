"use client"

import { useMemo, useState } from "react"
import { CircleCheck, Info, RotateCcw, TriangleAlert, X } from "lucide-react"
import { ExportButtons } from "@/components/export/export-buttons"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { TextField } from "@/components/forms/text-field"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { rsaCsvRows, rsaPlainText, rsaReport } from "@/lib/export/rsa"
import { generateProposals, type Proposal, type RsaBrief } from "@/lib/rsa/formulas"
import { RSA, type AssetKind } from "@/lib/rsa/limits"
import { previewCombination } from "@/lib/rsa/preview"
import { adHints, validateAd, type AdAsset, type RsaAd } from "@/lib/rsa/validate"
import { cn } from "@/lib/utils"
import { AdPreview } from "./ad-preview"
import { AssetEditor } from "./asset-editor"
import { BriefFormFields, EMPTY_BRIEF_FORM, type BriefForm } from "./brief-form"
import { normalizeText, ProposalList } from "./proposal-list"

const EMPTY_AD: RsaAd = {
  headlines: [],
  descriptions: [],
  finalUrl: "",
  path1: "",
  path2: "",
}
const FILE_BASE = "reklama-rsa"
const listOf = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
// Ids only need to be unique within the page session.
let assetCounter = 0
const newAsset = (text = ""): AdAsset => ({ id: `a${++assetCounter}`, text, pin: null })

const listKey = (kind: AssetKind) => (kind === "headline" ? "headlines" : "descriptions")

export function RsaBuilder() {
  const [briefForm, setBriefForm] = useState<BriefForm>(EMPTY_BRIEF_FORM)
  const [ad, setAd] = useState<RsaAd>(EMPTY_AD)
  const [proposalKind, setProposalKind] = useState<AssetKind>("headline")
  const [seed, setSeed] = useState(0)

  const brief: RsaBrief = useMemo(
    () => ({
      brand: briefForm.brand,
      product: briefForm.product,
      keywords: listOf(briefForm.keywords),
      benefits: listOf(briefForm.benefits),
      audience: briefForm.audience,
      ctas: listOf(briefForm.ctas),
      price: briefForm.price,
      problem: briefForm.problem,
      offer: briefForm.offer,
    }),
    [briefForm]
  )
  const proposals = useMemo(() => generateProposals(brief), [brief])
  const validation = useMemo(() => validateAd(ad), [ad])
  const hints = useMemo(() => adHints(ad, brief.keywords), [ad, brief.keywords])
  const preview = useMemo(() => previewCombination(ad, seed), [ad, seed])

  const list = (kind: AssetKind) => ad[listKey(kind)]
  const used = (kind: AssetKind) => new Set(list(kind).map((a) => normalizeText(a.text)))
  const isFull = (kind: AssetKind) => list(kind).length >= RSA[kind].maxCount
  const hasContent = [...ad.headlines, ...ad.descriptions].some((a) => a.text.trim())

  const addProposal = (p: Proposal) =>
    setAd((current) => {
      const key = listKey(p.kind)
      const items = current[key]
      // Reuse an empty slot before adding a new one.
      const emptyIndex = items.findIndex((a) => !a.text.trim())
      if (emptyIndex !== -1) {
        return {
          ...current,
          [key]: items.map((a, i) => (i === emptyIndex ? { ...a, text: p.text } : a)),
        }
      }
      if (items.length >= RSA[p.kind].maxCount) return current
      return { ...current, [key]: [...items, newAsset(p.text)] }
    })

  const updateAsset = (kind: AssetKind) => (id: string, patch: Partial<AdAsset>) =>
    setAd((current) => ({
      ...current,
      [listKey(kind)]: current[listKey(kind)].map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    }))

  const removeAsset = (kind: AssetKind) => (id: string) =>
    setAd((current) => ({
      ...current,
      [listKey(kind)]: current[listKey(kind)].filter((a) => a.id !== id),
    }))

  const addEmpty = (kind: AssetKind) => () =>
    setAd((current) =>
      current[listKey(kind)].length >= RSA[kind].maxCount
        ? current
        : { ...current, [listKey(kind)]: [...current[listKey(kind)], newAsset()] }
    )

  // A blank field explains itself; listing "Pusty tekst" under it would only be noise.
  const visibleIssues = Object.fromEntries(
    Object.entries(validation.assets).map(([id, issues]) => [
      id,
      issues.filter((i) => i.message !== "Pusty tekst."),
    ])
  )

  const reset = () => {
    setBriefForm(EMPTY_BRIEF_FORM)
    setAd(EMPTY_AD)
    setSeed(0)
  }

  const exportCsv = () =>
    downloadCsv(toCsv(rsaCsvRows(ad)), datedFilename(FILE_BASE, "csv"))
  const exportText = () =>
    downloadBlob(
      new Blob([rsaPlainText(ad)], { type: "text/plain;charset=utf-8" }),
      datedFilename(FILE_BASE, "txt")
    )
  const exportPdf = async () => {
    const { renderTableReport } = await import("@/lib/pdf/table-report")
    downloadBlob(
      await renderTableReport(rsaReport(ad, validation)),
      datedFilename(FILE_BASE, "pdf")
    )
  }

  const count = (kind: AssetKind) => proposals.filter((p) => p.kind === kind).length

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["rsa-builder"]}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons
              disabled={!hasContent}
              onCsv={exportCsv}
              onText={exportText}
              onPdf={exportPdf}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <p className="flex gap-3 rounded-xl border border-[#2f3848] bg-[#141925] px-4 py-3 text-sm leading-relaxed text-[#c9cfdb]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#a89dff]" aria-hidden="true" />
          Propozycje powstają z Twoich danych i gotowych formuł, bez AI. Szablony nie
          odmieniają słów, więc przeczytaj każdy tekst i popraw gramatykę przed
          publikacją.
        </p>

        <Panel
          title="O czym jest reklama"
          description="Pięć pierwszych pól wystarczy, by zobaczyć propozycje. Pola opcjonalne odblokowują kolejne formuły."
        >
          <BriefFormFields
            value={briefForm}
            onChange={(patch) => setBriefForm((f) => ({ ...f, ...patch }))}
          />
        </Panel>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:gap-6">
          <Panel
            title="Propozycje"
            description="Kliknij tekst, aby dodać go do reklamy. Pokazujemy tylko teksty mieszczące się w limicie."
          >
            <SegmentedControl
              label="Rodzaj propozycji"
              value={proposalKind}
              onChange={setProposalKind}
              options={[
                { value: "headline", label: `Nagłówki (${count("headline")})` },
                { value: "description", label: `Teksty (${count("description")})` },
              ]}
              className="mb-6 flex w-full [&>button]:flex-1"
            />
            {proposals.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                Wpisz nazwę firmy, produkt, słowa kluczowe, korzyści i wezwanie do
                działania. Propozycje pojawią się tutaj.
              </p>
            ) : (
              <ProposalList
                kind={proposalKind}
                proposals={proposals}
                brief={brief}
                used={used(proposalKind)}
                full={isFull(proposalKind)}
                onAdd={addProposal}
              />
            )}
          </Panel>

          <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
            <Panel title="Podgląd">
              <AdPreview preview={preview} onShuffle={() => setSeed((s) => s + 1)} />
            </Panel>

            <Panel
              title="Twoja reklama"
              description="Edytuj teksty, przypinaj do pozycji, kopiuj pojedynczo."
            >
              <div className="flex flex-col gap-7">
                <section aria-label="Nagłówki">
                  <h3 className="mb-3 text-sm font-semibold">
                    Nagłówki{" "}
                    <span className="font-normal text-muted-foreground">
                      do 30 znaków
                    </span>
                  </h3>
                  <AssetEditor
                    kind="headline"
                    assets={ad.headlines}
                    issues={visibleIssues}
                    onChange={updateAsset("headline")}
                    onRemove={removeAsset("headline")}
                    onAdd={addEmpty("headline")}
                  />
                </section>
                <section aria-label="Teksty reklamy">
                  <h3 className="mb-3 text-sm font-semibold">
                    Teksty reklamy{" "}
                    <span className="font-normal text-muted-foreground">
                      do 90 znaków
                    </span>
                  </h3>
                  <AssetEditor
                    kind="description"
                    assets={ad.descriptions}
                    issues={visibleIssues}
                    onChange={updateAsset("description")}
                    onRemove={removeAsset("description")}
                    onAdd={addEmpty("description")}
                  />
                </section>
                <section
                  aria-label="Adres"
                  className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2"
                >
                  <TextField
                    className="sm:col-span-2"
                    label="Adres strony docelowej"
                    required
                    mono
                    inputMode="url"
                    value={ad.finalUrl}
                    onChange={(finalUrl) => setAd((a) => ({ ...a, finalUrl }))}
                    placeholder="https://biegam.pl/buty"
                  />
                  <TextField
                    label="Ścieżka 1"
                    mono
                    value={ad.path1}
                    onChange={(path1) => setAd((a) => ({ ...a, path1 }))}
                    placeholder="buty"
                    hint="Do 15 znaków, widoczna w adresie."
                  />
                  <TextField
                    label="Ścieżka 2"
                    mono
                    value={ad.path2}
                    onChange={(path2) => setAd((a) => ({ ...a, path2 }))}
                    placeholder="damskie"
                    hint="Do 15 znaków."
                  />
                </section>
              </div>
            </Panel>

            {hasContent && (
              <Panel title="Stan reklamy">
                <AdStatus valid={validation.valid} issues={validation.ad} hints={hints} />
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function AdStatus({
  valid,
  issues,
  hints,
}: {
  valid: boolean
  issues: ReturnType<typeof validateAd>["ad"]
  hints: string[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium",
          valid
            ? "border-success/35 bg-success/10 text-[#6fe0b4]"
            : "border-destructive/40 bg-destructive/10 text-[#f59a9a]"
        )}
        aria-live="polite"
      >
        {valid ? (
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <X className="size-4 shrink-0" aria-hidden="true" />
        )}
        {valid
          ? "Reklama spełnia limity i zasady, które sprawdzamy."
          : "Popraw zaznaczone błędy przed publikacją."}
      </p>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue) => (
            <li
              key={issue.message}
              className={cn(
                "flex gap-2 text-xs leading-relaxed",
                issue.severity === "error" ? "text-[#f59a9a]" : "text-[#f7cf7c]"
              )}
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {hints.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Wskazówki (to nie jest ocena skuteczności Google)
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-[#c9cfdb] marker:text-muted-foreground">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
