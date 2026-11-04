import type { ReportLogo } from "@/lib/reports/model"

const MAX_LOGO_BYTES = 1024 * 1024

/** Reads a PNG or JPEG into a data URL with its pixel size. SVG is refused: jsPDF cannot embed it. */
export function readLogo(file: File): Promise<ReportLogo> {
  return new Promise((resolve, reject) => {
    const format =
      file.type === "image/png" ? "PNG" : file.type === "image/jpeg" ? "JPEG" : null
    if (!format) return reject(new Error("Logo musi być w formacie PNG albo JPG."))
    if (file.size > MAX_LOGO_BYTES)
      return reject(new Error("Logo może mieć najwyżej 1 MB."))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onload = () =>
        resolve({
          dataUrl,
          format,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      image.onerror = () => reject(new Error("Plik nie jest poprawnym obrazem."))
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
