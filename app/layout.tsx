import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileHeader } from "@/components/layout/mobile-header"
import { SiteFooter } from "@/components/layout/site-footer"
import "./globals.css"

// latin-ext carries Polish diacritics (ą, ę, ł, ś, ż…).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
})
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
})

export const metadata: Metadata = {
  title: {
    default: "Ads Toolkit: kalkulatory i raporty Google Ads",
    template: "%s · Ads Toolkit",
  },
  description:
    "Osiem narzędzi do kampanii Google Ads: rentowność, budżet, słowa kluczowe, wykluczenia, UTM, reklamy RSA, testy A/B i raporty PPC. Bez logowania, dane zostają w przeglądarce.",
}

export const viewport: Viewport = {
  themeColor: "#0b0d12",
}

/**
 * Production-only CSP as a meta tag, so it also works on static hosting without headers.
 * Everything runs locally: no external scripts, fonts or connections. Next.js inlines its
 * bootstrap scripts, hence 'unsafe-inline' for scripts (no nonces without a server).
 * Dev mode needs eval for React Refresh, so the policy is left out there.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ")

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`dark ${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      {process.env.NODE_ENV === "production" && (
        <head>
          <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
          <meta name="referrer" content="no-referrer" />
        </head>
      )}
      <body className="min-h-dvh">
        <div className="flex min-h-dvh">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileHeader />
            <main className="flex-1 px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  )
}
