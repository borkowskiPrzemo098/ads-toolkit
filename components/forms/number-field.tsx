"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Unit shown inside the field, e.g. "%" or "zł". */
  suffix?: string
  placeholder?: string
  hint?: string
  error?: string | null
  optional?: boolean
  className?: string
}

/**
 * Text input for decimals: accepts both "12,5" and "12.5". Keeps the raw string so the
 * user's typing is never reformatted under the cursor; parse with `parseDecimal`.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  hint,
  error,
  optional,
  className,
}: NumberFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
        )}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(suffix && "pr-10")}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
