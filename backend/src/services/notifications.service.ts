import { createTenantClient } from '../db/supabase'
import {
  iNotificationFeedItem,
  iCustomReminder,
  iCreateReminderDTO,
  iUpdateReminderDTO,
  NOTIFICATION_ORDER_STATUSES,
} from '../types'

// Cap on how many order-derived items feed a single request. Fetched as
// one query across all relevant statuses (replacing the four separate
// per-status round trips the frontend currently makes), ordered by
// most-recently-updated so the cap trims the least relevant items first.
const FEED_ORDER_CAP = 100

// GET /api/notifications
export async function getNotificationFeed(
  token: string,
  businessId: string,
): Promise<iNotificationFeedItem[]> {
  const supabase = createTenantClient(token)

  const [ordersResult, remindersResult, dismissalsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, client_name, mineral_type, total_zar, status, updated_at')
      .eq('business_id', businessId)
      .in('status', NOTIFICATION_ORDER_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(FEED_ORDER_CAP),

    supabase
      .from('custom_reminders')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),

    supabase
      .from('notification_dismissals')
      .select('notification_key')
      .eq('business_id', businessId),
  ])

  if (ordersResult.error) {
    throw new Error(`Failed to fetch orders for notifications: ${ordersResult.error.message}`)
  }
  if (remindersResult.error) {
    throw new Error(`Failed to fetch reminders: ${remindersResult.error.message}`)
  }
  if (dismissalsResult.error) {
    throw new Error(`Failed to fetch dismissals: ${dismissalsResult.error.message}`)
  }

  const dismissedKeys = new Set(
    (dismissalsResult.data ?? []).map((d: { notification_key: string }) => d.notification_key)
  )

  const orderItems: iNotificationFeedItem[] = (ordersResult.data ?? [])
    .map((order): iNotificationFeedItem => ({
      kind: 'order',
      key: `${order.status}-${order.id}`,
      order_id: order.id,
      order_number: order.order_number,
      client_name: order.client_name,
      mineral_type: order.mineral_type,
      total_zar: Number(order.total_zar),
      status: order.status,
      timestamp: order.updated_at,
    }))
    .filter((item) => !dismissedKeys.has(item.key))

  const reminderItems: iNotificationFeedItem[] = (remindersResult.data ?? []).map(
    (r: iCustomReminder): iNotificationFeedItem => ({
      kind: 'reminder',
      key: r.id,
      id: r.id,
      title: r.title,
      detail: r.detail,
      done: r.done,
      timestamp: r.created_at,
    })
  )

  return [...orderItems, ...reminderItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

// POST /api/notifications/reminders
export async function createReminder(
  token: string,
  businessId: string,
  createdById: string,
  dto: iCreateReminderDTO,
): Promise<iCustomReminder> {
  const supabase = createTenantClient(token)

  const { data, error } = await supabase
    .from('custom_reminders')
    .insert({
      business_id: businessId,
      created_by: createdById,
      title: dto.title.trim(),
      detail: dto.detail?.trim() || null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create reminder: ${error?.message}`)
  return data as iCustomReminder
}

// PATCH /api/notifications/reminders/:id
export async function updateReminder(
  token: string,
  businessId: string,
  id: string,
  dto: iUpdateReminderDTO,
): Promise<iCustomReminder> {
  const supabase = createTenantClient(token)

  const payload: Partial<iUpdateReminderDTO> = {}
  if (dto.title !== undefined) payload.title = dto.title.trim()
  if (dto.detail !== undefined) payload.detail = dto.detail.trim()

  if (Object.keys(payload).length === 0) {
    throw new Error('No valid fields provided for update.')
  }

  const { data, error } = await supabase
    .from('custom_reminders')
    .update(payload)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update reminder: ${error?.message}`)
  return data as iCustomReminder
}

// PATCH /api/notifications/reminders/:id/toggle
export async function toggleReminderDone(
  token: string,
  businessId: string,
  id: string,
): Promise<iCustomReminder> {
  const supabase = createTenantClient(token)

  const { data: current, error: fetchError } = await supabase
    .from('custom_reminders')
    .select('done')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (fetchError || !current) throw new Error('Reminder not found.')

  const { data, error } = await supabase
    .from('custom_reminders')
    .update({ done: !current.done })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to toggle reminder: ${error?.message}`)
  return data as iCustomReminder
}

// DELETE /api/notifications/reminders/:id
export async function deleteReminder(
  token: string,
  businessId: string,
  id: string,
): Promise<void> {
  const supabase = createTenantClient(token)

  const { error } = await supabase
    .from('custom_reminders')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) throw new Error(`Failed to delete reminder: ${error.message}`)
}

// POST /api/notifications/dismiss
// Idempotent — dismissing the same key twice is a no-op, not an error.
export async function dismissNotification(
  token: string,
  businessId: string,
  dismissedById: string,
  key: string,
): Promise<void> {
  const supabase = createTenantClient(token)

  const { error } = await supabase
    .from('notification_dismissals')
    .upsert(
      { business_id: businessId, notification_key: key, dismissed_by: dismissedById },
      { onConflict: 'business_id,notification_key', ignoreDuplicates: true },
    )

  if (error) throw new Error(`Failed to dismiss notification: ${error.message}`)
}