import { supabase } from '../db/supabase'
import { iOrder } from '../types'

/**
 * Audit Service
 *
 * Writes an immutable audit trail for every field-level change on orders.
 * The audit_logs table is protected by triggers that prevent UPDATE and
 * DELETE, ensuring the trail cannot be tampered with.
 *
 * ── Failure policy ────────────────────────────────────────────────────────
 * Audit writes are intentionally non-blocking — a failure must not break
 * order creation or mutation.  However, silent failures are a compliance
 * risk: if the audit trail has gaps they become invisible until forensics.
 *
 * ── Fix: structured error logging ────────────────────────────────────────
 * The original code swallowed audit failures with a plain console.error.
 * We now emit a structured error object so any log aggregator (Datadog,
 * Sentry, CloudWatch) can alert on audit failures.
 *
 * TODO: replace logAuditError() with your error-tracking SDK call
 * (e.g. Sentry.captureException) once one is integrated.
 */

/* Internal helpers */

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

/* Only tracked order fieldss are recorded in the audit trail */
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
  updated: iOrder
): Promise<void> {
  const entries: {
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

/**
 * Logs a cancellation with the previous status for clear before/after context.
 */
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

/**
 * Returns the full audit trail for a single order, newest entries first.
 */
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