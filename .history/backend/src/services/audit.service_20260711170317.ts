import { supabase } from '../db/supabase'
import { iOrder } from '../types'

/**
 * Emits a structured error to the console.
 * Replace the body of this function with your error-tracking SDK call.
 *
 * @param context  - Name of the calling function (for log correlation).
 * @param message  - Human-readable description of what failed.
 * @param detail   - Any additional context (DB error message, ids, etc.).
 */
function logAuditError(context: string, message: string, detail?: unknown): void {
  console.error(JSON.stringify({
    level: 'error',
    service: 'audit',
    context,
    message,
    detail: detail ?? null,
    timestamp: new Date().toISOString(),
  }))
}

const TRACKED_FIELDS: (keyof iOrder)[] = [
  'client_name',
  'mineral_type',
  'quantity_kg',
  'unit_price_zar',
  'status',
  'notes',
]

export async function logOrderChanges(
  orderId: string,
  changedById: string,
  previous: iOrder,
  updated: iOrder,
  businessId: string,
): Promise<void> {
  const entries: {
    business_id: string
    order_id: string
    changed_by: string
    field_changed: string
    old_value: string | null
    new_value: string | null
  }[] = []

  for (const field of TRACKED_FIELDS) {
    const oldVal = previous[field]
    const newVal = updated[field]

    if (String(oldVal) !== String(newVal)) {
      entries.push({
        business
        order_id: orderId,
        changed_by: changedById,
        field_changed: field,
        old_value: oldVal != null ? String(oldVal) : null,
        new_value: newVal != null ? String(newVal) : null,
      })
    }
  }

  if (entries.length === 0) return

  const { error } = await supabase.from('audit_logs').insert(entries)

  if (error) {
    logAuditError(
      'logOrderChanges',
      'Failed to write field-change audit entries',
      { orderId, changedById, dbError: error.message }
    )
  }
}

export async function logOrderCreated(
  orderId: string,
  changedById: string,
  orderNumber: string
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    order_id: orderId,
    changed_by: changedById,
    field_changed: 'order',
    old_value: null,
    new_value: `Order ${orderNumber} created`,
  })

  if (error) {
    logAuditError(
      'logOrderCreated',
      'Failed to log order creation',
      { orderId, changedById, orderNumber, dbError: error.message }
    )
  }
}

export async function logOrderCancelled(
  orderId: string,
  changedById: string,
  previousStatus: string
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    order_id: orderId,
    changed_by: changedById,
    field_changed: 'status',
    old_value: previousStatus,
    new_value: 'cancelled',
  })

  if (error) {
    logAuditError(
      'logOrderCancelled',
      'Failed to log order cancellation',
      { orderId, changedById, previousStatus, dbError: error.message }
    )
  }
}

export async function getAuditLogsForOrder(orderId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      changer:users!changed_by (id, full_name, email)
    `)
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`)
  }

  return data ?? []
}