import { HardDrive, KeyRound, UserRoundX } from "lucide-react"

const FACTS = [
  {
    icon: HardDrive,
    title: "Pliki nie opuszczają komputera",
    text: "Raporty CSV czytamy w przeglądarce. Nic nie trafia na serwer.",
  },
  {
    icon: UserRoundX,
    title: "Bez konta i logowania",
    text: "Otwierasz narzędzie i liczysz. Nie zbieramy adresów e-mail.",
  },
  {
    icon: KeyRound,
    title: "Bez dostępu do Google Ads",
    text: "Nie prosimy o klucze API ani o podłączenie konta reklamowego.",
  },
]

export function PrivacyBand() {
  return (
    <section
      aria-labelledby="privacy-heading"
      className="rounded-xl border border-border bg-sidebar px-5 py-6 sm:px-7"
    >
      <h2 id="privacy-heading" className="text-base font-semibold tracking-tight">
        Twoje dane zostają u Ciebie
      </h2>
      <ul className="mt-5 grid gap-5 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
        {FACTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 md:px-6 md:first:pl-0 md:last:pr-0">
            <Icon
              className="mt-0.5 size-5 shrink-0 text-success"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
