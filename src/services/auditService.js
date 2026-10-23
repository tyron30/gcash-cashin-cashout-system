import { supabase } from './supabaseClient'
import { call } from './errors'

export const AUDIT_PAGE_SIZE = 20

const ENTITY_TYPES = ['transaction', 'daily_closing', 'profile', 'store_settings', 'fee_tiers']

export async function listAuditLogs({ entityType = 'all', page = 1 } = {}) {
  const from = (Math.max(1, page) - 1) * AUDIT_PAGE_SIZE

  let query = supabase
    .from('audit_logs')
    .select('id, created_at, actor_name, action, entity_type, entity_id, reason, previous_values, new_values', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1)

  if (ENTITY_TYPES.includes(entityType)) query = query.eq('entity_type', entityType)

  const { data, count } = await call(query)
  const total = count ?? 0

  return {
    items: data.map((row) => ({
      id: row.id,
      at: row.created_at,
      actorName: row.actor_name ?? 'Unknown',
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: row.reason,
      previous: row.previous_values,
      next: row.new_values,
    })),
    total,
    page: Math.max(1, page),
    pageSize: AUDIT_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  }
}
