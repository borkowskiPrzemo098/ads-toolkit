"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, RotateCcw } from "lucide-react"
import { NumberField } from "@/components/forms/number-field"
import { Panel } from "@/components/layout/panel"
import { Button } from "@/components/ui/button"
import { toolHref } from "@/constants/tools"
import { breakEvenRoas, maxCpa } from "@/lib/calculations/profitability"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  parseDecimal,
} from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

const NOT_A_NUMBER = "Wpisz liczbę, np. 30 albo 30,5."

/** Dashboard quick access: break-even ROAS and max CPA from margin and order value. */
export function QuickBreakEven() {
  const [margin, setMargin] = useState("")
  const [orderValue, setOrderValue] = useState("")

  const marginValue = parseDecimal(margin)
  const orderNumber = parseDecimal(orderValue)
  const marginError = margin.trim() && marginValue === null ? NOT_A_NUMBER : null
  const orderError = orderValue.trim() && orderNumber === null ? NOT_A_NUMBER : null

  const roas = marginValue === null ? null : breakEvenRoas(marginValue)
  const cpa =
    marginValue === null || orderNumber === null ? null : maxCpa(orderNumber, marginValue)

  const hasInput = margin !== "" || orderValue !== ""

  return (
    <Panel
      title="Szybki próg rentowności"
      description="Jaki ROAS pokrywa koszt reklamy przy Twojej marży?"
      action={
        hasInput && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMargin("")
              setOrderValue("")
            }}
          >
            <RotateCcw />
            Wyczyść
          </Button>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Marża"
          suffix="%"
          placeholder="np. 30"
          value={margin}
          onChange={setMargin}
          error={marginError}
        />
        <NumberField
          label="Średnie zamówienie"
          suffix="zł"
          placeholder="np. 250"
          value={orderValue}
          onChange={setOrderValue}
          error={orderError}
          hint="Opcjonalnie, do maksymalnego CPA."
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-background/60">
        <Result
          label="Break-even ROAS"
          value={roas?.ok ? formatPercent(roas.value, 0) : null}
          detail={
            roas?.ok
              ? `${formatNumber(roas.value / 100, 2)} zł przychodu na 1 zł reklamy`
              : (roas?.reason ?? "Wpisz marżę")
          }
          warn={roas !== null && !roas.ok}
        />
        <Result
          label="Maksymalny CPA"
          value={cpa?.ok ? formatCurrency(cpa.value) : null}
          detail={
            cpa?.ok
              ? "tyle może kosztować jedna sprzedaż"
              : (cpa?.reason ?? "Wpisz marżę i średnie zamówienie")
          }
          warn={cpa !== null && !cpa.ok}
          className="border-l border-border"
        />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Poniżej tego ROAS każda sprzedaż z reklamy przynosi stratę, jeszcze przed kosztami
        stałymi. Pełne wyliczenie z kosztami produktu znajdziesz w{" "}
        <Link
          href={toolHref("profitability")}
          className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary"
        >
          kalkulatorze rentowności
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </p>
    </Panel>
  )
}

interface ResultProps {
  label: string
  value: string | null
  detail: string
  warn?: boolean
  className?: string
}

function Result({ label, value, detail, warn, className }: ResultProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 p-4", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tracking-tight tabular sm:text-[1.75rem]",
          value ? "text-foreground" : "text-[#4a5466]"
        )}
        aria-live="polite"
      >
        {value ?? "—"}
      </dd>
      <dd
        className={cn(
          "text-xs leading-snug",
          warn ? "text-warning" : "text-muted-foreground"
        )}
      >
        {detail}
      </dd>
    </div>
  )
}
