/** Triggers a browser download of locally generated content. Nothing leaves the device. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so Safari has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadCsv(csv: string, filename: string) {
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename)
}

/** "rentownosc-kampanii-2026-11-03.csv" */
export function datedFilename(base: string, extension: string, date = new Date()) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
  return `${base}-${day}.${extension}`
}
