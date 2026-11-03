// Publishes out/ to the gh-pages branch (GitHub Pages "deploy from branch").
// Run after `npm run test:e2e`, which builds out/ with the /ads-toolkit base path.
import { execSync } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"

const out = join(process.cwd(), "out")
if (!existsSync(join(out, "index.html")) || !existsSync(join(out, ".nojekyll"))) {
  console.error("Brak out/ z buildem. Uruchom najpierw: npm run test:e2e")
  process.exit(1)
}

const remote = execSync("git remote get-url origin").toString().trim()
const commit = execSync("git rev-parse --short HEAD").toString().trim()
const run = (cmd) => execSync(cmd, { cwd: out, stdio: "inherit" })

rmSync(join(out, ".git"), { recursive: true, force: true })
run("git init -q -b gh-pages")
run("git add -A")
run(
  `git -c user.name="Ads Toolkit deploy" -c user.email="deploy@localhost" commit -q -m "Publikacja ${commit}"`
)
run(`git push -f ${remote} gh-pages`)
rmSync(join(out, ".git"), { recursive: true, force: true })
console.log(`Opublikowano ${commit} na gałęzi gh-pages.`)
