// Checks a LIVE website from the outside. Run after every deployment:
//   npm run verify:deploy -- https://your-app.vercel.app
//   npm run verify:deploy -- https://gcash.yourstore.com --supabase-ref=abcdefghijklmnop
// The --supabase-ref option makes sure the site is wired to the PRODUCTION database.
const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith('--'))
const expectRef = args.find((a) => a.startsWith('--supabase-ref='))?.split('=')[1]
if (!target) {
  console.error('Usage: npm run verify:deploy -- https://your-site [--supabase-ref=PROJECTREF]')
  process.exit(1)
}

const base = (/^https?:\/\//.test(target) ? target : `https://${target}`).replace(/\/+$/, '')
const url = new URL(base)
const local = ['localhost', '127.0.0.1'].includes(url.hostname)

let failed = 0
let warned = 0
const line = (level, text, detail = '') => {
  if (level === 'FAIL') failed += 1
  if (level === 'WARN') warned += 1
  console.log(`${level.padEnd(4)}  ${text}${detail ? `\n        ${detail}` : ''}`)
}
const get = (path, options = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000), ...options })

console.log(`Checking ${base}\n`)

// 1) HTTPS
if (local) line('INFO', 'Local address: HTTPS checks skipped')
else if (url.protocol !== 'https:') line('FAIL', 'The address must start with https://')
else line('PASS', 'Uses HTTPS')

if (!local && url.protocol === 'https:') {
  try {
    const res = await fetch(`http://${url.host}/`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    const to = res.headers.get('location') ?? ''
    if ([301, 302, 307, 308].includes(res.status) && to.startsWith('https://')) line('PASS', 'http:// is redirected to https://')
    else line('WARN', 'http:// did not redirect to https://', `status ${res.status}`)
  } catch {
    line('INFO', 'Plain http:// is not reachable (also fine)')
  }
}

// 2) The page itself
let html = ''
try {
  const res = await get('/')
  html = await res.text()
  if (res.status !== 200) line('FAIL', `Home page returned ${res.status}`)
  else if (!html.includes('id="root"')) line('FAIL', 'Home page loaded but is not the app')
  else line('PASS', 'Home page loads')

  const h = (name) => res.headers.get(name) ?? ''
  const csp = h('content-security-policy')
  csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'") && !csp.includes('unsafe-eval')
    ? line('PASS', 'Content-Security-Policy is strict')
    : line('FAIL', 'Content-Security-Policy is missing or too loose', csp || '(no header)')
  h('x-frame-options').toUpperCase() === 'DENY' ? line('PASS', 'Cannot be embedded in other sites') : line('FAIL', 'X-Frame-Options is not DENY')
  h('x-content-type-options').toLowerCase() === 'nosniff' ? line('PASS', 'X-Content-Type-Options: nosniff') : line('FAIL', 'X-Content-Type-Options missing')
  h('referrer-policy') ? line('PASS', 'Referrer-Policy set') : line('FAIL', 'Referrer-Policy missing')
  h('permissions-policy') ? line('PASS', 'Permissions-Policy set') : line('WARN', 'Permissions-Policy missing')
  h('x-robots-tag').includes('noindex') ? line('PASS', 'Search engines told not to index') : line('WARN', 'X-Robots-Tag noindex missing')
  if (!local) h('strict-transport-security') ? line('PASS', 'HSTS set (browsers will insist on HTTPS)') : line('FAIL', 'Strict-Transport-Security missing')
} catch (error) {
  line('FAIL', 'Could not load the site', error.message)
  console.log(`\n${failed} failed.`)
  process.exit(1)
}

// 3) Deep links and refresh must work (single-page app rewrite)
try {
  const res = await get('/transactions')
  const body = await res.text()
  res.status === 200 && body.includes('id="root"')
    ? line('PASS', 'Refreshing a deep link (/transactions) works')
    : line('FAIL', 'Deep link /transactions does not open the app', `status ${res.status}. Is vercel.json deployed?`)
} catch (error) {
  line('FAIL', 'Deep link check failed', error.message)
}

// 4) Phone install files
try {
  const res = await get('/manifest.webmanifest')
  const manifest = await res.json()
  const icon = await get(manifest.icons?.[0]?.src ?? '/icons/icon-192.png')
  res.status === 200 && icon.status === 200 && (icon.headers.get('content-type') ?? '').includes('image/png')
    ? line('PASS', 'Phone install files (manifest and icons) are served')
    : line('WARN', 'Manifest or icon not served correctly')
} catch {
  line('WARN', 'Manifest could not be read')
}

// 5) Inspect the shipped JavaScript
const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
let bundle = ''
for (const path of new Set(scripts)) {
  try {
    bundle += await (await get(path)).text()
  } catch {
    /* ignore a single chunk */
  }
}
if (!bundle) {
  line('FAIL', 'Could not read the website JavaScript')
} else {
  /service_role|sb_secret_[A-Za-z0-9_-]{10,}/.test(bundle)
    ? line('FAIL', 'A SECRET KEY MARKER IS INSIDE THE WEBSITE. Take the site down and rotate keys now.')
    : line('PASS', 'No secret key inside the website code')

  try {
    const cache = (await get(scripts[0])).headers.get('cache-control') ?? ''
    cache.includes('immutable') ? line('PASS', 'Static files are cached for speed') : line('WARN', 'Static files are not cached long-term')
  } catch {
    /* optional */
  }

  const ref = bundle.match(/https:\/\/([a-z0-9]{15,25})\.supabase\.co/)?.[1]
  if (!ref) {
    line('FAIL', 'No Supabase address inside the website', 'The environment variables were probably not set BEFORE the build. Add them in Vercel, then redeploy.')
  } else {
    line('INFO', `Website is connected to Supabase project: ${ref}`)
    if (expectRef) ref === expectRef ? line('PASS', 'It is the project you expected (production)') : line('FAIL', `Expected project ${expectRef} but the site uses ${ref}`, 'You may have shipped the development database.')
    else line('WARN', 'Confirm that project is your PRODUCTION one', 'Re-run with --supabase-ref=<production ref> to check automatically.')

    // 6) A stranger with only what the website ships must get nothing.
    const key =
      bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0] ??
      (bundle.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []).find((t) => {
        try {
          return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role === 'anon'
        } catch {
          return false
        }
      })
    if (!key) {
      line('WARN', 'Could not find the public key inside the website to test with')
    } else {
      const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) }
      const api = `https://${ref}.supabase.co/rest/v1`
      try {
        for (const table of ['transactions', 'profiles', 'audit_logs', 'daily_closings']) {
          const res = await fetch(`${api}/${table}?select=*&limit=1`, { headers, signal: AbortSignal.timeout(20000) })
          const body = res.ok ? await res.json().catch(() => null) : null
          const empty = Array.isArray(body) && body.length === 0
          res.status === 401 || res.status === 403 || empty
            ? line('PASS', `A logged-out visitor cannot read ${table}`)
            : line('FAIL', `A LOGGED-OUT VISITOR CAN READ ${table} (status ${res.status})`)
        }
        const rpc = await fetch(`${api}/rpc/create_transaction`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_transaction_type: 'cash_in', p_reference_number: 'TESTVERIFY01', p_amount: 1 }),
          signal: AbortSignal.timeout(20000),
        })
        rpc.status >= 400 ? line('PASS', 'A logged-out visitor cannot record a transaction') : line('FAIL', 'A LOGGED-OUT VISITOR CAN CALL create_transaction')
      } catch (error) {
        line('WARN', 'Could not reach Supabase to test anonymous access', error.message)
      }
    }
  }
}

console.log(`\n${failed ? `FAILED: ${failed} problem(s)` : 'PASSED'}${warned ? `, ${warned} warning(s)` : ''}.`)
process.exit(failed ? 1 : 0)
