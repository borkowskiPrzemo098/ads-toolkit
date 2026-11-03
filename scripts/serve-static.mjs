// Minimal static server for the `out/` export, mimicking GitHub Pages: the site lives under
// BASE_PATH, folders serve index.html, unknown paths get 404.html with status 404.
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"

const root = join(process.cwd(), "out")
const port = Number(process.env.PORT ?? 3420)
const base = process.env.BASE_PATH ?? ""

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
}

function resolve(pathname) {
  if (!pathname.startsWith(`${base}/`)) return null
  const file = normalize(join(root, decodeURIComponent(pathname.slice(base.length))))
  if (!file.startsWith(root) || !existsSync(file)) return null
  return statSync(file).isDirectory()
    ? existsSync(join(file, "index.html"))
      ? join(file, "index.html")
      : null
    : file
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost")
  // GitHub Pages redirects folder URLs without the trailing slash.
  if (
    pathname === base ||
    (!extname(pathname) && !pathname.endsWith("/") && resolve(`${pathname}/`))
  ) {
    res.writeHead(301, { Location: `${pathname}/` }).end()
    return
  }
  const file = resolve(pathname)
  const status = file ? 200 : 404
  const path = file ?? join(root, "404.html")
  res.writeHead(status, {
    "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
  })
  createReadStream(path).pipe(res)
}).listen(port, () => console.log(`out/ on http://localhost:${port}${base}/`))
