"use client"

import { useId } from "react"
import { ChevronDown } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface SelectFieldProps<T extends string> {
  label: string
  /** Visually hide the label while keeping it for screen readers. */
  hideLabel?: boolean
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

/** Native select: keyboard, touch and screen readers behave as users expect. */
export function SelectField<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
  className,
}: SelectFieldProps<T>) {
  const id = useId()
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-10 w-full appearance-none rounded-lg border border-input bg-input/30 pr-9 pl-3 text-sm transition-colors outline-none hover:border-[#3a4456] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-popover">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
