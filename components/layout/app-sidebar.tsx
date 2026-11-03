import { Logo } from "./logo"
import { NavLinks } from "./nav-links"
import { PrivacyNote } from "./privacy-note"

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="px-5 pt-5 pb-6">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks />
      </div>
      <div className="border-t border-sidebar-border px-5 py-4">
        <PrivacyNote />
      </div>
    </aside>
  )
}
