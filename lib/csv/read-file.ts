/** Files are read in the browser only; this cap keeps the tab responsive. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export class FileReadError extends Error {}

/**
 * Decodes text by its byte-order mark. Google Ads Keyword Planner exports UTF-16 LE;
 * report exports are UTF-8, often with a BOM. Without a BOM UTF-8 is assumed.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes.subarray(2))
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return new TextDecoder("utf-8").decode(bytes.subarray(3))
  return new TextDecoder("utf-8").decode(bytes)
}

export async function readTextFile(file: File, allowed: string[]): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!allowed.includes(extension)) {
    throw new FileReadError(
      `Obsługujemy pliki: ${allowed.map((e) => `.${e}`).join(", ")}.`
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileReadError("Plik jest większy niż 5 MB. Podziel go na mniejsze części.")
  }
  if (file.size === 0) throw new FileReadError("Plik jest pusty.")
  return decodeText(new Uint8Array(await file.arrayBuffer()))
}
