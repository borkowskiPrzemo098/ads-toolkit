// Next.js 16.4 static export writes per-segment prefetch payloads into nested folders
// (tools/x/__next.tools/x/__PAGE__.txt), while the client router requests flat names
// (tools/x/__next.tools.x.__PAGE__.txt). Without a server to map them, every prefetch
// 404s and links fall back to full page loads. Copy each nested payload to its flat name.
import { copyFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"

const root = join(process.cwd(), "out")
let copied = 0

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_next") continue
    const path = join(dir, entry.name)
    if (entry.name.startsWith("__next.")) flatten(dir, path)
    else walk(path)
  }
}

function flatten(pageDir, segmentDir) {
  for (const entry of readdirSync(segmentDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue
    const file = join(entry.parentPath, entry.name)
    const flat = relative(pageDir, file).split(sep).join(".")
    copyFileSync(file, join(pageDir, flat))
    copied++
  }
}

walk(root)
console.log(`fix-export: ${copied} segment payloads copied to flat names`)
