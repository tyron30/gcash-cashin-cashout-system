// Checks the deployment files are present, valid, and consistent.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const vercel = JSON.parse(read('vercel.json'))
const headerOf = (name) => vercel.headers.flatMap((r) => r.headers).find((h) => h.key === name)?.value

function pngSize(path) {
  const buffer = readFileSync(new URL(path, root))
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG', `${path} is not a PNG`)
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

describe('security headers (vercel.json)', () => {
  const csp = headerOf('Content-Security-Policy')

  it('has a strict Content-Security-Policy', () => {
    assert.ok(csp)
    assert.match(csp, /default-src 'self'/)
    assert.match(csp, /frame-ancestors 'none'/)
    assert.match(csp, /object-src 'none'/)
    assert.ok(!csp.includes('unsafe-eval'))
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'inline scripts must stay blocked')
  })
  it('the browser may only talk to this site and Supabase', () => {
    const connect = csp.match(/connect-src ([^;]*)/)[1].split(' ')
    assert.deepEqual(connect, ["'self'", 'https://*.supabase.co'])
  })
  it('has the other protective headers', () => {
    assert.equal(headerOf('X-Frame-Options'), 'DENY')
    assert.equal(headerOf('X-Content-Type-Options'), 'nosniff')
    assert.ok(headerOf('Referrer-Policy'))
    assert.match(headerOf('Strict-Transport-Security'), /max-age=\d{7,}/)
    assert.match(headerOf('X-Robots-Tag'), /noindex/)
    assert.match(headerOf('Permissions-Policy'), /camera=\(\)/)
  })
  it('the single-page-app rewrite does not swallow real files', () => {
    const source = vercel.rewrites[0].source
    for (const file of ['assets/', 'icons/', 'manifest\\.webmanifest']) assert.ok(source.includes(file), file)
    assert.equal(vercel.rewrites[0].destination, '/index.html')
    const pattern = new RegExp(`^${source}$`)
    assert.ok(pattern.test('/transactions'), 'app routes are rewritten')
    assert.ok(pattern.test('/transactions/123e4567-e89b-12d3-a456-426614174000'), 'record pages are rewritten')
    assert.ok(pattern.test('/'), 'home is rewritten')
    assert.ok(!pattern.test('/assets/index-abc.js'), 'JS files are served as files')
    assert.ok(!pattern.test('/manifest.webmanifest'))
    assert.ok(!pattern.test('/icons/icon-192.png'))
  })
  it('Cloudflare/Netlify _headers file matches the Vercel CSP (no drift)', () => {
    const file = read('public/_headers')
    assert.ok(file.includes(`Content-Security-Policy: ${csp}`))
    assert.ok(file.includes('X-Frame-Options: DENY'))
    assert.match(read('public/_redirects'), /\/\*\s+\/index\.html\s+200/)
  })
})

describe('phone install files', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))

  it('manifest is complete', () => {
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.start_url, '/')
    assert.ok(manifest.name && manifest.short_name)
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i)
  })
  it('every icon exists and has the declared size', () => {
    for (const icon of manifest.icons) {
      const path = `public${icon.src}`
      assert.ok(existsSync(new URL(path, root)), path)
      const [w, h] = icon.sizes.split('x').map(Number)
      assert.deepEqual(pngSize(path), [w, h], path)
    }
    assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'))
    assert.deepEqual(pngSize('public/icons/apple-touch-icon.png'), [180, 180])
  })
  it('index.html links them and keeps the phone safe-area setting', () => {
    const html = read('index.html')
    assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/)
    assert.match(html, /rel="apple-touch-icon"/)
    assert.match(html, /viewport-fit=cover/)
  })
})

describe('project settings', () => {
  const pkg = JSON.parse(read('package.json'))
  it('declares a Node version Vite 7 supports, and the gate scripts exist', () => {
    assert.match(pkg.engines.node, /20\.19|22|24/)
    for (const script of ['build', 'test', 'preflight', 'verify:deploy', 'check:security']) assert.ok(pkg.scripts[script], script)
  })
  it('.env files are never committed (but .env.example is)', () => {
    const ignore = read('.gitignore')
    assert.match(ignore, /^\.env$/m)
    assert.match(ignore, /^\.env\.\*$/m)
    assert.match(ignore, /^!\.env\.example$/m)
  })
})
