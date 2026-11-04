"use client"

import { Download } from "lucide-react"
import { Panel } from "@/components/layout/panel"
import { Button } from "@/components/ui/button"
import { STATUS_LABEL, type Task, type TaskStatus } from "@/lib/auditor/action-plan"
import { planCsv } from "@/lib/auditor/export"
import type { Priority } from "@/lib/auditor/recommendations"
import { datedFilename, downloadCsv } from "@/lib/export/download"
import { formatNumber } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

const PRIORITY_STYLE: Record<Priority, string> = {
  Pilny: "bg-destructive text-[#0b0d12]",
  Wysoki: "bg-[#ff4f8b]/18 text-[#ff8db3] ring-[#ff4f8b]/40",
  Średni: "bg-warning/15 text-warning ring-warning/35",
  Niski: "bg-[#1a202c] text-[#c9cfdb] ring-border",
}

/** Spec section 11: tasks from the audit, each with priority, justification and a status. */
export function ActionPlanPanel({
  tasks,
  statuses,
  onStatus,
}: {
  tasks: Task[]
  statuses: Record<string, TaskStatus>
  onStatus: (id: string, status: TaskStatus) => void
}) {
  const done = tasks.filter((t) => statuses[t.id] === "done").length
  if (!tasks.length)
    return (
      <p className="text-sm text-muted-foreground">
        Audyt nie wygenerował zadań dla zaimportowanych danych.
      </p>
    )
  return (
    <Panel
      title="Plan działań"
      description="Zadania wynikające z audytu. Aplikacja nie zmienia niczego na koncie Google Ads: zadania wykonujesz ręcznie i oznaczasz tutaj."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCsv(planCsv(tasks, statuses), datedFilename("plan-dzialan", "csv"))
          }
        >
          <Download />
          CSV
        </Button>
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Zrobione:{" "}
        <span className="font-semibold text-(--tool) tabular">
          {formatNumber(done)} z {formatNumber(tasks.length)}
        </span>
      </p>
      <div className="mb-5 h-2 rounded-full bg-[#1a202c]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-(--tool) shadow-[0_0_12px_-2px_var(--tool)] transition-[width] duration-300 ease-out-quart"
          style={{ width: `${(done / tasks.length) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col gap-3">
        {tasks.map((t) => {
          const status = statuses[t.id] ?? "todo"
          return (
            <li
              key={t.id}
              className={cn(
                "rounded-xl border border-border bg-background/40 p-4 transition-opacity duration-150",
                status === "done" && "border-dashed"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-transparent ring-inset",
                        PRIORITY_STYLE[t.priority]
                      )}
                    >
                      {t.priority}
                    </span>
                    <h3
                      className={cn(
                        "font-semibold tracking-tight",
                        status === "done" && "text-muted-foreground line-through"
                      )}
                    >
                      {t.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{t.description}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Uzasadnienie: {t.justification}
                  </p>
                  <p className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
                    Dotyczy: {t.subjects.slice(0, 6).join(", ")}
                    {t.subjects.length > 6 ? ` i ${t.subjects.length - 6} innych` : ""}
                  </p>
                </div>
                <select
                  aria-label={`Status: ${t.title}`}
                  value={status}
                  onChange={(e) => onStatus(t.id, e.target.value as TaskStatus)}
                  className="h-9 shrink-0 rounded-lg border border-input bg-background px-2.5 text-sm [color-scheme:dark]"
                >
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}
