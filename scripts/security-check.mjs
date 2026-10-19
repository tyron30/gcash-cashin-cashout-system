// Scans the project for common security mistakes. Run:  npm run check:security
// Exit code 1 = something must be fixed before deploying.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const SKIP = new Set(['node_modules', '.git', 'dist', 'tests'])
const results = []
const add = (level, message) => results.push({ level, message })

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return []
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(root).filter((f) => /\.(jsx?|mjs|html|json|toml|md|sql|ps1)$|(^|[\\/])\.env[^\\/]*$/.test(f))
const rel = (f) => relative(root, f).replaceAll('\\', '/')

function decodeJwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role
  } catch {
    return null
  }
}

// 1) Secret keys anywhere (source, config, .env files, docs).
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) add('FAIL', `Supabase secret key found in ${rel(file)}`)
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    if (decodeJwtRole(jwt) === 'service_role') add('FAIL', `service_role key found in ${rel(file)}`)
  }
}

// 2) Frontend environment variables must be safe to publish.
for (const file of files.filter((f) => /[\\/]\.env[^\\/]*$/.test(f))) {
  const name = rel(file)
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=/)
    if (match && /SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN/.test(match[1])) {
      add('FAIL', `${name}: ${match[1]} will be PUBLIC in the website. Remove it.`)
    }
  }
}

// 3) .env must never be committed.
const gitignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : ''
if (!/^\.env$/m.test(gitignore)) add('FAIL', '.gitignore does not list ".env"')
if (!/^\.env\.\*$|^\.env\.local$/m.test(gitignore)) add('WARN', '.gitignore should also ignore .env.* files (except .env.example)')

// 4) Risky code patterns in the app source.
const risky = [
  [/dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/, 'raw HTML insertion (XSS risk)'],
  [/\beval\s*\(|new Function\s*\(/, 'eval / new Function'],
  [/document\.write\s*\(/, 'document.write'],
  [/localStorage|sessionStorage/, 'browser storage (must never hold transaction data)'],
  [/service_role/, 'mention of service_role in app code'],
]
for (const file of files.filter((f) => /[\\/]src[\\/].*\.jsx?$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, label] of risky) {
    if (pattern.test(text) && !rel(file).endsWith('supabaseClient.js') && !rel(file).endsWith('ConfigErrorPage.jsx')) {
      add('FAIL', `${rel(file)}: ${label}`)
    }
  }
  if (/console\.(log|debug)\(/.test(text)) add('WARN', `${rel(file)}: console.log left in code`)
}

// 5) Production build, if it exists: no secrets inside the website files.
if (existsSync('dist')) {
  for (const file of walk('dist').concat([])) {
    if (!/\.(js|html|css|map)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    if (/service_role|sb_secret_/.test(text)) add('FAIL', `dist build contains a secret marker: ${rel(file)}`)
    if (file.endsWith('.map')) add('WARN', `source map shipped: ${rel(file)} (turn sourcemaps off for production)`)
  }
} else {
  add('INFO', 'No dist folder. Run "npm run build" first to also scan the production files.')
}

// 6) Security headers file for the host.
if (!existsSync('vercel.json')) add('WARN', 'vercel.json (security headers) is missing')

const order = { FAIL: 0, WARN: 1, INFO: 2 }
results.sort((a, b) => order[a.level] - order[b.level])
for (const r of results) console.log(`${r.level.padEnd(5)} ${r.message}`)

const fails = results.filter((r) => r.level === 'FAIL').length
const warns = results.filter((r) => r.level === 'WARN').length
console.log(`\n${fails} problem(s), ${warns} warning(s). Scanned ${files.length} files.`)
if (fails === 0) console.log('PASS: no secrets or risky patterns found.')
process.exit(fails ? 1 : 0)
