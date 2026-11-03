// `npm run build` with the GitHub Pages base path, without depending on shell syntax for env vars.
import { spawnSync } from "node:child_process"

const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PAGES_BASE_PATH: process.env.PAGES_BASE_PATH ?? "/ads-toolkit" },
})
process.exit(result.status ?? 1)
