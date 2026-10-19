// The last gate before deploying. Run:  npm run preflight
// Runs tests, the production build, and the security scan, and checks your setup.
// It prints GO or NO-GO. Use --skip-build only for a quick re-check.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const skipBuild = process.argv.includes('--skip-build')
const results = []
const note = (level, label, detail = '') => results.push({ level, label, detail })

function run(label, command) {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(command, { shell: true, stdio: 'inherit' })
  note(result.status === 0 ? 'PASS' : 'FAIL', label)
}

run('Automated tests', 'npm test')
run('Accessibility contrast', 'npm run check:contrast')
if (skipBuild) note('WARN', 'Production build', 'skipped (--skip-build)')
else run('Production build', 'npm run build')
run('Security scan (includes the built files)', 'npm run check:security')

console.log('\n=== Setup checks ===')

// Deployment files
for (const file of ['vercel.json', 'public/manifest.webmanifest', 'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/apple-touch-icon.png']) {
  note(existsSync(file) ? 'PASS' : 'FAIL', `File present: ${file}`)
}
try {
  JSON.parse(readFileSync('vercel.json', 'utf8'))
  note('PASS', 'vercel.json is valid JSON')
} catch {
  note('FAIL', 'vercel.json is not valid JSON')
}

// Local .env (only matters for local use; Vercel gets its own copy of the values)
if (existsSync('.env')) {
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
  )
  const match = (env.VITE_SUPABASE_URL ?? '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)
  note(match ? 'PASS' : 'WARN', 'Local .env has a Supabase URL', match ? `project ref: ${match[1]}` : 'expected https://<ref>.supabase.co')
  note(env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'PASS' : 'WARN', 'Local .env has a publishable key')
  if (match) {
    note('INFO', 'CONFIRM BY HAND', `Local .env points to project "${match[1]}". On Vercel you must use your PRODUCTION project's values, which may be different.`)
  }
} else {
  note('INFO', 'No local .env', 'Fine for deploying. Vercel uses the values you type into its settings.')
}

// Git hygiene
if (existsSync('.git')) {
  const ignored = spawnSync('git check-ignore .env', { shell: true }).status === 0 || !existsSync('.env')
  note(ignored ? 'PASS' : 'FAIL', '.env is ignored by git (it will not be uploaded)')
  const dirty = spawnSync('git status --porcelain', { shell: true, encoding: 'utf8' }).stdout.trim()
  note(dirty ? 'WARN' : 'PASS', 'All changes are committed', dirty ? 'uncommitted changes exist' : '')
} else {
  note('INFO', 'No git repository yet', 'Needed only for the GitHub route (see docs/PHASE6_DEPLOYMENT.md).')
}

console.log('\n=== RESULT ===')
for (const r of results) console.log(`${r.level.padEnd(5)} ${r.label}${r.detail ? `  (${r.detail})` : ''}`)
const fails = results.filter((r) => r.level === 'FAIL').length
const warns = results.filter((r) => r.level === 'WARN').length
console.log(
  fails
    ? `\nNO-GO: ${fails} check(s) failed. Fix them, then run again.`
    : `\nGO: all checks passed${warns ? ` (${warns} warning(s) to read above)` : ''}.`,
)
process.exit(fails ? 1 : 0)
