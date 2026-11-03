"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "./logo"
import { NavLinks } from "./nav-links"
import { PrivacyNote } from "./privacy-note"

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
      <Logo />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon-lg" aria-label="Otwórz menu" />}
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 gap-0 border-sidebar-border bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="px-5 pt-5 pb-6">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto px-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-sidebar-border px-5 py-4">
            <PrivacyNote />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
