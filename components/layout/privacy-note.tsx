import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export function PrivacyNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted-foreground",
        className
      )}
    >
      <ShieldCheck className="mt-px size-4 shrink-0 text-success" strokeWidth={1.75} />
      <span>
        Obliczenia i pliki zostają w Twojej przeglądarce. Nic nie wysyłamy na serwer.
      </span>
    </p>
  )
}
