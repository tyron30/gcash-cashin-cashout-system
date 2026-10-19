// Reads the SQL files and checks the SECURITY RULES are still in place.
// This catches mistakes (like a forgotten RLS line) before they reach the database.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const dir = new URL('../../supabase/migrations/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const sql = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')
const code = sql.replace(/--[^\n]*/g, '') // ignore comments

// Functions that must NOT be callable by the app (internal helpers and triggers).
const INTERNAL = new Set([
  'assert_admin', 'store_timezone', 'normalize_reference', 'write_audit_log', 'validate_transaction_fields',
  'validate_transaction_input', 'set_updated_at', 'prevent_modification', 'handle_new_user', 'guard_profile_changes', 'set_business_date',
  'protect_transaction_fields', 'enforce_open_business_day',
])

const tables = [...code.matchAll(/create table public\.(\w+)/g)].map((m) => m[1])
const functions = [...code.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1])
const uniqueFunctions = [...new Set(functions)]

describe('database security rules (static check of the SQL files)', () => {
  it('finds the expected tables', () => {
    assert.deepEqual(tables.sort(), ['audit_logs', 'daily_closings', 'profiles', 'store_settings', 'transactions'])
  })

  it('every table has Row Level Security enabled', () => {
    for (const table of tables) {
      assert.match(code, new RegExp(`alter table public\\.${table}\\s+enable row level security`), table)
    }
  })

  it('nothing is ever granted or exposed to the logged-out role (anon)', () => {
    assert.ok(!/grant[^;]*\bto\b[^;]*\banon\b/i.test(code), 'a grant to anon exists')
    assert.ok(!/create policy[^;]*\bto\b[^;]*\banon\b/i.test(code), 'a policy for anon exists')
  })

  it('every policy is limited to logged-in users and is read-only', () => {
    const policies = [...code.matchAll(/create policy (\w+)\s+on public\.(\w+) for (\w+) to (\w+)/g)]
    assert.ok(policies.length >= 6)
    for (const [, name, , action, role] of policies) {
      assert.equal(role, 'authenticated', name)
      assert.ok(['select', 'update'].includes(action), `${name}: unexpected ${action}`)
    }
  })

  it('money tables have NO write policies and no write permissions', () => {
    for (const table of ['transactions', 'audit_logs', 'daily_closings', 'store_settings']) {
      assert.ok(!new RegExp(`create policy \\w+\\s+on public\\.${table} for (insert|update|delete|all)`).test(code), table)
      assert.ok(!new RegExp(`grant[^;]*(insert|update|delete|all)[^;]*on public\\.${table}`, 'i').test(code), table)
    }
  })

  it('profiles: only the name column can be updated directly', () => {
    assert.match(code, /grant update \(full_name\) on public\.profiles to authenticated/)
    assert.ok(!/grant update on public\.profiles/i.test(code))
  })

  it('the email column is hidden from normal users', () => {
    assert.match(code, /revoke select on public\.profiles from authenticated/)
    const columnGrant = code.match(/grant select \(([^)]*)\) on public\.profiles to authenticated/)
    assert.ok(columnGrant)
    assert.ok(!columnGrant[1].includes('email'))
  })

  it('every SECURITY DEFINER function pins its search_path', () => {
    const blocks = code.split(/create or replace function /).slice(1)
    for (const block of blocks) {
      const header = block.split(/\bas \$\$/)[0]
      if (/security definer/i.test(header)) {
        assert.match(header, /set search_path = ''/, header.split('(')[0])
      }
    }
  })

  it('every app-callable function is explicitly granted to logged-in users, and internal ones are not', () => {
    const granted = new Set([...code.matchAll(/grant execute on function public\.(\w+)\(/g)].map((m) => m[1]))
    for (const name of uniqueFunctions) {
      if (INTERNAL.has(name)) assert.ok(!granted.has(name), `${name} is internal but granted`)
      else assert.ok(granted.has(name), `${name} is not granted to authenticated`)
    }
  })

  it('execute is never granted to anon or public', () => {
    assert.ok(!/grant execute[^;]*\bto\b[^;]*\b(anon|public)\b/i.test(code))
  })

  it('transactions and the audit log are protected against delete and truncate', () => {
    assert.match(code, /create trigger transactions_no_delete/)
    assert.match(code, /create trigger transactions_no_truncate/)
    assert.match(code, /create trigger audit_logs_no_update_delete/)
    assert.match(code, /create trigger audit_logs_no_truncate/)
  })

  it('business date, locked days, and protected fields are enforced by triggers', () => {
    assert.match(code, /create trigger transactions_10_set_business_date/)
    assert.match(code, /create trigger transactions_20_protect_fields/)
    assert.match(code, /create trigger transactions_30_enforce_open_day/)
  })

  it('functions added after the main permission lockdown are explicitly revoked from everyone', () => {
    // Postgres lets everyone run a NEW function by default. Migration 5 fixed the old ones;
    // anything created later must carry its own "revoke execute".
    const early = new Set()
    const late = new Set()
    for (const file of files) {
      const body = readFileSync(new URL(file, dir), 'utf8').replace(/--[^\n]*/g, '')
      const names = [...body.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1])
      names.forEach((n) => (file < '20261014000600' ? early.add(n) : late.add(n)))
    }
    for (const name of late) {
      if (early.has(name)) continue // re-created: it keeps its permissions
      assert.match(code, new RegExp(`revoke execute on function public\\.${name}\\(`), `${name} is not revoked`)
    }
  })

  it('the reference number rule: required for cash-out only, enforced by the database', () => {
    assert.match(code, /alter column reference_number drop not null/)
    assert.match(code, /transaction_type <> 'cash_out' or reference_number is not null/)
    assert.match(code, /drop function if exists public\.validate_transaction_fields/)
  })

  it('amounts are constrained in the database itself', () => {
    assert.match(code, /amount > 0 and amount <= 999999\.99/)
    assert.match(code, /transaction_type in \('cash_in', 'cash_out'\)/)
    assert.match(code, /status in \('completed', 'voided'\)/)
  })

  it('new logins start inactive and as staff', () => {
    assert.match(code, /is_active\s+boolean not null default false/)
    assert.match(code, /'staff',\s*\n?\s*false/)
  })
})

describe('frontend never holds a secret', () => {
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : [new URL(e.name, d)]))
  const sources = walk(new URL('../../src/', import.meta.url)).filter((u) => /\.jsx?$/.test(u.pathname))

  it('no real secret key value (sb_secret_... or a service_role JWT) in the source code', () => {
    for (const url of sources) {
      const text = readFileSync(url, 'utf8')
      assert.ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(text), `secret key in ${url.pathname}`)
      for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
        assert.notEqual(payload.role, 'service_role', `service_role key in ${url.pathname}`)
      }
    }
  })
})
