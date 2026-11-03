"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string | null
  required?: boolean
  /** Technical values (URLs, parameter names) read better in a monospace face. */
  mono?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  className?: string
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  required,
  mono,
  inputMode,
  className,
}: TextFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {!required && (
          <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
        )}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(mono && "font-mono text-[13px]")}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
