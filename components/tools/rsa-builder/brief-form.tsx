"use client"

import { TextField } from "@/components/forms/text-field"

export interface BriefForm {
  brand: string
  product: string
  keywords: string
  benefits: string
  audience: string
  ctas: string
  price: string
  problem: string
  offer: string
}

export const EMPTY_BRIEF_FORM: BriefForm = {
  brand: "",
  product: "",
  keywords: "",
  benefits: "",
  audience: "",
  ctas: "",
  price: "",
  problem: "",
  offer: "",
}

const FIELDS: {
  key: keyof BriefForm
  label: string
  placeholder: string
  hint: string
  required?: boolean
}[] = [
  {
    key: "brand",
    label: "Nazwa firmy",
    placeholder: "np. Biegam.pl",
    hint: "Tak, jak ma się wyświetlać.",
    required: true,
  },
  {
    key: "product",
    label: "Produkt lub usługa",
    placeholder: "np. Buty do biegania",
    hint: "W mianowniku, krótko.",
    required: true,
  },
  {
    key: "keywords",
    label: "Główne słowa kluczowe",
    placeholder: "np. buty do biegania, buty biegowe",
    hint: "Oddziel przecinkami.",
    required: true,
  },
  {
    key: "benefits",
    label: "Najważniejsze korzyści",
    placeholder: "np. Darmowa dostawa, 30 dni na zwrot",
    hint: "Krótkie hasła, oddziel przecinkami.",
    required: true,
  },
  {
    key: "ctas",
    label: "Wezwanie do działania",
    placeholder: "np. Sprawdź ofertę, Kup teraz",
    hint: "Oddziel przecinkami.",
    required: true,
  },
  {
    key: "audience",
    label: "Grupa docelowa",
    placeholder: "np. biegaczy, małych firm",
    hint: "Tak, jak brzmi po słowie „dla”.",
  },
  {
    key: "price",
    label: "Cena lub rabat",
    placeholder: "np. od 199 zł, -20%",
    hint: "Tylko prawdziwa, aktualna cena.",
  },
  {
    key: "problem",
    label: "Problem klienta",
    placeholder: "np. Obtarte stopy po bieganiu",
    hint: "Do formuły problem + rozwiązanie.",
  },
  {
    key: "offer",
    label: "Dodatkowe informacje o ofercie",
    placeholder: "np. Wysyłka w 24 h",
    hint: "Konkret, który odróżnia ofertę.",
  },
]

interface BriefFormProps {
  value: BriefForm
  onChange: (patch: Partial<BriefForm>) => void
}

export function BriefFormFields({ value, onChange }: BriefFormProps) {
  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {FIELDS.map((field) => (
        <TextField
          key={field.key}
          label={field.label}
          required={field.required}
          value={value[field.key]}
          onChange={(v) => onChange({ [field.key]: v })}
          placeholder={field.placeholder}
          hint={field.hint}
        />
      ))}
    </div>
  )
}
