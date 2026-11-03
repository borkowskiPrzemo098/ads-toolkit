/// <reference lib="webworker" />
// Parses imported reports off the main thread, so a 50 MB export does not freeze the page.
import { ImportError, parseSheet } from "./parse"

self.onmessage = async (event: MessageEvent<{ id: string; bytes: ArrayBuffer }>) => {
  const { id, bytes } = event.data
  try {
    const table = await parseSheet(new Uint8Array(bytes))
    self.postMessage({ id, table })
  } catch (error) {
    const message =
      error instanceof ImportError ? error.message : "Nie udało się odczytać pliku."
    self.postMessage({ id, error: message })
  }
}
