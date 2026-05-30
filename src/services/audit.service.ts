import { supabase } from '../db/supabase'
import { Order, UpdateOrderDTO } from '../types'

// 
// RESPONSIBILITY:
//   Write one audit_log row per field that changed on an order.
//   Called by the orders controller after every successful update.
//

// Fields we track changes for
const TRACKED_FIELDS: (keyof Order)[] = [
  'client_name',
  'mineral_type',
  'quantity_kg',
  'unit_price_zar',
  'status',
  'notes',
]

export async function logOrderChanges(
  orderId:     string,
  changedById: string,
  previous:    Order,
  updated:     Order
): Promise<void> {
  const entries: {
    order_id:      string
    changed_by:    string
    field_changed: string
    old_value:     string | null
    new_value:     string | null
  }[] = []

  for (const field of TRACKED_FIELDS) {
    const oldVal = previous[field]
    const newVal = updated[field]

    // Only log if the value actually changed
    if (String(oldVal) !== String(newVal)) {
      entries.push({
        order_id:      orderId,
        changed_by:    changedById,
        field_changed: field,
        old_value:     oldVal !== null && oldVal !== undefined ? String(oldVal) : null,
        new_value:     newVal !== null && newVal !== undefined ? String(newVal) : null,
      })
    }
  }

  if (entries.length === 0) return

  const { error } = await supabase.from('audit_logs').insert(entries)

  if (error) {
    console.error('[AuditService] Failed to write audit log:', error.message)
  }
}

// Log order creation as a single audit entry
export async function logOrderCreated(
  orderId:     string,
  changedById: string,
  orderNumber: string
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    order_id:      orderId,
    changed_by:    changedById,
    field_changed: 'order',
    old_value:     null,
    new_value:     `Order ${orderNumber} created`,
  })

  if (error) {
    console.error('[AuditService] Failed to log order creation:', error.message)
  }
}

// Log cancellation explicitly
export async function logOrderCancelled(
  orderId:       string,
  changedById:   string,
  previousStatus: string
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    order_id:      orderId,
    changed_by:    changedById,
    field_changed: 'status',
    old_value:     previousStatus,
    new_value:     'cancelled',
  })

  if (error) {
    console.error('[AuditService] Failed to log cancellation:', error.message)
  }
}

// Fetch full audit trail for a single order
export async function getAuditLogsForOrder(orderId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      changer:users!changed_by (id, full_name, email)
    `)
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
  return data ?? []
}
