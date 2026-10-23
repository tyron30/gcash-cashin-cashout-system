// End-to-end security test through the REAL Supabase web API, exactly the way the
// browser talks to it (this is different from the SQL Editor tests, which skip the API layer).
//
// !! This creates a few small test transactions (reference starts with "TEST") and then VOIDS them.
// !! Voided records cannot be deleted, so they stay in History. Run it on your DEVELOPMENT
// !! project, or accept 3-4 voided "TEST" rows in the real one.
//
// Run (PowerShell):  see docs/PHASE5_TESTING_AND_SECURITY.md, section "API security test".
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const env = process.env
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'TEST_OWNER_EMAIL',
  'TEST_OWNER_PASSWORD',
  'TEST_STAFF_EMAIL',
  'TEST_STAFF_PASSWORD',
]
const missing = required.filter((name) => !env[name])
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}\nSee docs/PHASE5_TESTING_AND_SECURITY.md for how to set them.`)
  process.exit(1)
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, options)
const staff = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, options)
const owner = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, options)

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) passed += 1
  else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `\n        ${detail}` : ''}`)
}
const blocked = (res) => Boolean(res.error)
const nothing = (res) => Boolean(res.error) || (res.data?.length ?? 0) === 0
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
const daysAgo = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() - n * 86400000))
let counter = 0
const reference = () => `TEST${Date.now().toString().slice(-9)}${(counter += 1)}`
const created = []

async function login(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`Could not sign in the ${label} test account: ${error.message}`)
    process.exit(1)
  }
  return data.user
}

const createArgs = (extra = {}) => ({
  p_transaction_type: 'cash_in',
  p_reference_number: null, // a cash-in has no reference number
  p_amount: 1,
  p_sender_receiver_name: null,
  p_notes: 'Automated security test',
  p_transaction_timestamp: null,
  p_client_request_id: randomUUID(),
  ...extra,
})

console.log('\n--- Logged-out visitor ---')
for (const table of ['transactions', 'profiles', 'audit_logs', 'daily_closings', 'store_settings', 'fee_tiers']) {
  check(`visitor cannot read ${table}`, nothing(await anon.from(table).select('*').limit(1)))
}
check('visitor cannot create_transaction', blocked(await anon.rpc('create_transaction', createArgs())))
check('visitor cannot daily_totals', blocked(await anon.rpc('daily_totals', { p_from: today, p_to: today, p_type: null })))
check('visitor cannot search_transactions', blocked(await anon.rpc('search_transactions', { p_from: today, p_to: today })))

const staffUser = await login(staff, env.TEST_STAFF_EMAIL, env.TEST_STAFF_PASSWORD, 'staff')
const ownerUser = await login(owner, env.TEST_OWNER_EMAIL, env.TEST_OWNER_PASSWORD, 'owner')

console.log('\n--- Staff ---')
const key = randomUUID()
const first = await staff.rpc('create_transaction', createArgs({ p_client_request_id: key }))
if (first.error) {
  console.error(`Staff could not record a test transaction: ${first.error.message}`)
  console.error('(If the message says the day is closed, reopen it in Daily Closing and run again.)')
  process.exit(1)
}
const id1 = first.data.id
created.push(id1)
check('staff can record a transaction', Boolean(id1))
check('a cash-in needs no reference number (stored blank)', first.data.reference_number === null, `got ${first.data.reference_number}`)
check(
  'the database added the fee and total (total = amount + fee)',
  Number(first.data.total_amount) === Number(first.data.amount) + Number(first.data.fee_amount),
  JSON.stringify({ amount: first.data.amount, fee: first.data.fee_amount, total: first.data.total_amount }),
)
check('business date is today (Manila)', first.data.business_date === today, `got ${first.data.business_date}`)

const again = await staff.rpc('create_transaction', createArgs({ p_client_request_id: key }))
check('same request id never creates a second record', !again.error && again.data.id === id1)

check('a cash-out WITHOUT a reference is rejected', blocked(await staff.rpc('create_transaction', createArgs({ p_transaction_type: 'cash_out', p_reference_number: null }))))
const cashOut = await staff.rpc('create_transaction', createArgs({ p_transaction_type: 'cash_out', p_reference_number: reference() }))
if (cashOut.data?.id) created.push(cashOut.data.id)
check('a cash-out WITH a reference saves', !cashOut.error && Boolean(cashOut.data?.reference_number), cashOut.error?.message)

check('a save is refused when the screen showed a different fee', blocked(await staff.rpc('create_transaction', createArgs({ p_expected_fee: 999999 }))))
check('staff can read the fee table', !(await staff.from('fee_tiers').select('*')).error)
check('staff cannot change the fee table (function)', blocked(await staff.rpc('save_fee_tiers', { p_tiers: [{ max_amount: 100, fee_amount: 0 }] })))
check('staff cannot write to the fee table directly', nothing(await staff.from('fee_tiers').update({ fee_amount: 0 }).neq('max_amount', 0).select()) && blocked(await staff.from('fee_tiers').insert({ max_amount: 99999, fee_amount: 0 })))

for (const amount of [0, -5, 10.123, 1000000]) {
  check(`staff cannot save amount ${amount}`, blocked(await staff.rpc('create_transaction', createArgs({ p_amount: amount }))))
}
check(
  'staff cannot choose an old date/time',
  blocked(await staff.rpc('create_transaction', createArgs({ p_transaction_timestamp: new Date(Date.now() - 2 * 86400000).toISOString() }))),
)
check(
  'staff cannot insert into the table directly',
  blocked(await staff.from('transactions').insert({ reference_number: reference(), transaction_type: 'cash_in', amount: 1, created_by: staffUser.id, business_date: today })),
)
check('staff cannot update directly', nothing(await staff.from('transactions').update({ amount: 999 }).eq('id', id1).select()))
check('staff cannot delete', nothing(await staff.from('transactions').delete().eq('id', id1).select()))
check('staff cannot void', blocked(await staff.rpc('void_transaction', { p_id: id1, p_reason: 'staff tries to void' })))
check('staff cannot edit', blocked(await staff.rpc('update_transaction', { p_id: id1, p_reference_number: reference(), p_amount: 2, p_sender_receiver_name: null, p_notes: null, p_transaction_timestamp: new Date().toISOString(), p_reason: 'staff tries to edit' })))
check('staff cannot read the audit log', nothing(await staff.from('audit_logs').select('id').limit(1)))
check('staff cannot read daily closings', nothing(await staff.from('daily_closings').select('id').limit(1)))
check('staff cannot read the email column', blocked(await staff.from('profiles').select('email').limit(1)))
check('staff cannot list accounts', blocked(await staff.rpc('admin_list_profiles')))
check('staff cannot get staff totals', blocked(await staff.rpc('staff_totals', { p_business_date: today })))
check('staff cannot close a day', blocked(await staff.rpc('save_daily_closing', { p_business_date: today, p_cash_counted: 1, p_recorded_cash_balance: 1, p_closing_notes: null, p_close: false })))
check('staff cannot change store settings', blocked(await staff.rpc('update_store_settings', { p_store_name: 'Hacked', p_staff_history_days: 31 })))
check('staff cannot make themselves admin', nothing(await staff.from('profiles').update({ role: 'admin' }).eq('id', staffUser.id).select()))

const search = await staff.rpc('search_transactions', { p_from: daysAgo(10), p_to: today })
check(
  'staff only ever see today, even when asking for 10 days',
  !search.error && search.data.every((row) => row.business_date === today),
  search.error?.message,
)

console.log('\n--- Owner ---')
check('owner can see the staff record', (await owner.from('transactions').select('id').eq('id', id1)).data?.length === 1)

const noReason = await owner.rpc('update_transaction', { p_id: id1, p_reference_number: first.data.reference_number, p_amount: 2, p_sender_receiver_name: null, p_notes: null, p_transaction_timestamp: first.data.transaction_timestamp, p_reason: '' })
check('editing without a reason is rejected', blocked(noReason))
const edited = await owner.rpc('update_transaction', { p_id: id1, p_reference_number: first.data.reference_number, p_amount: 2, p_sender_receiver_name: null, p_notes: null, p_transaction_timestamp: first.data.transaction_timestamp, p_reason: 'Automated test edit' })
check('owner can edit with a reason', !edited.error && Number(edited.data.amount) === 2, edited.error?.message)

const totalsOf = async () => {
  const { data, error } = await owner.rpc('daily_totals', { p_from: today, p_to: today, p_type: null })
  if (error) throw new Error(error.message)
  return { total: Number(data[0].cash_in_total), count: Number(data[0].cash_in_count) }
}
const before = await totalsOf()
const second = await staff.rpc('create_transaction', createArgs({ p_amount: 5 }))
created.push(second.data?.id)
const during = await totalsOf()
check('dashboard total goes up by exactly the new amount', Math.abs(during.total - before.total - 5) < 0.001 && during.count === before.count + 1, JSON.stringify({ before, during }))
check('owner can void with a reason', !(await owner.rpc('void_transaction', { p_id: second.data.id, p_reason: 'Automated test void' })).error)
const after = await totalsOf()
check('a voided record leaves the totals', Math.abs(after.total - before.total) < 0.001 && after.count === before.count, JSON.stringify({ before, after }))

check('owner can void the first record', !(await owner.rpc('void_transaction', { p_id: id1, p_reason: 'Automated test cleanup' })).error)
check('voiding twice is rejected', blocked(await owner.rpc('void_transaction', { p_id: id1, p_reason: 'Automated test again' })))
check('a voided record cannot be edited', blocked(await owner.rpc('update_transaction', { p_id: id1, p_reference_number: first.data.reference_number, p_amount: 3, p_sender_receiver_name: null, p_notes: null, p_transaction_timestamp: first.data.transaction_timestamp, p_reason: 'Edit after void' })))
check('the record is kept (voided, not deleted)', (await owner.from('transactions').select('status').eq('id', id1)).data?.[0]?.status === 'voided')

const audit = await owner.from('audit_logs').select('action').eq('entity_id', id1)
const actions = (audit.data ?? []).map((row) => row.action)
check('created, edited and voided were all audited', ['transaction.created', 'transaction.updated', 'transaction.voided'].every((a) => actions.includes(a)), actions.join())

const people = await owner.rpc('admin_list_profiles')
check('owner can list accounts with emails', !people.error && people.data.some((p) => p.id === staffUser.id && p.email), people.error?.message)
check('staff role is still "staff"', people.data?.find((p) => p.id === staffUser.id)?.role === 'staff')
check('owner cannot demote themselves', blocked(await owner.rpc('admin_update_profile', { p_user_id: ownerUser.id, p_role: 'staff', p_is_active: null, p_full_name: null })))
check('owner cannot rewrite the audit log', nothing(await owner.from('audit_logs').update({ action: 'hacked' }).eq('entity_id', id1).select()))
check('owner cannot delete the audit log', nothing(await owner.from('audit_logs').delete().eq('entity_id', id1).select()))
check('owner cannot write to the fee table directly either', blocked(await owner.from('fee_tiers').insert({ max_amount: 88888, fee_amount: 0 })))
check('owner cannot write to transactions directly', blocked(await owner.from('transactions').insert({ reference_number: reference(), transaction_type: 'cash_in', amount: 1, created_by: ownerUser.id, business_date: today })))

// Clean up: void any test record that is still active (records are never deleted).
for (const id of created.filter(Boolean)) {
  await owner.rpc('void_transaction', { p_id: id, p_reason: 'Automated test cleanup' })
}

console.log(`\n${passed} passed, ${failed} failed.`)
console.log('Test records were voided. They remain in History as voided "TEST..." rows (records are never deleted).')
process.exit(failed ? 1 : 0)
