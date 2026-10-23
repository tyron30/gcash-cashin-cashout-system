import { supabase } from './supabaseClient'
import { call } from './errors'

// Everyone who is logged in and active can read the fee table (the form shows the fee).
export async function listFeeTiers() {
  const { data } = await call(
    supabase.from('fee_tiers').select('id, max_amount, fee_amount').order('max_amount', { ascending: true }),
  )
  return data.map((row) => ({ id: row.id, maxAmount: Number(row.max_amount), feeAmount: Number(row.fee_amount) }))
}

// Owner only. Replaces the whole table in one safe step; the change is audited.
export async function saveFeeTiers(tiers) {
  await call(
    supabase.rpc('save_fee_tiers', {
      p_tiers: tiers.map((tier) => ({ max_amount: tier.maxAmount, fee_amount: tier.feeAmount })),
    }),
  )
}
