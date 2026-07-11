import { supabase } from '../db/supabase'
import { generateOrderNumber } from '../utils/orderNumber'
import {
  iOrder,
  iOrderStatus,
  iCreateOrderDTO,
  iUpdateOrderDTO,
  iOrderFilters,
  iPaginatedResult,
} from '../types'

/* Input sanitisation helpers */
function sanitiseLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')   /* backslash must come first */
    .replace(/%/g, '\\%')    /* percent wildcard */
    .replace(/_/g, '\\_')    /* single-char wildcard */
    .trim()
}

/*
 * Returns true when the value is a valid ISO-8601 date string (YYYY-MM-DD).
 */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  return !isNaN(d.getTime())
}

/* Create */
export async function createOrder(
  dto: iCreateOrderDTO,
  createdById: string,
  businessId: string
): Promise<iOrder> {
  const order_number = await generateOrderNumber(businessId)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_number,
      business_id: businessId,
      client_name: dto.client_name.trim(),
      mineral_type: dto.mineral_type.trim(),
      quantity_kg: dto.quantity_kg,
      unit_price_zar: dto.unit_price_zar,
      notes: dto.notes?.trim() ?? null,
      created_by: createdById,
    })
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error) throw new Error('Failed to create order.')
  return data as iOrder
}

/* Get many (with filters + pagination) */

export async function getOrders(
  filters: iOrderFilters,
  businessId: string,
): Promise<iPaginatedResult<iOrder>> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('v_orders_with_creator')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)

  /* Apply filters (sanitised) */
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.mineral_type) {
    query = query.ilike('mineral_type', `%${sanitiseLike(filters.mineral_type)}%`)
  }

  if (filters.client_name) {
    query = query.ilike('client_name', `%${sanitiseLike(filters.client_name)}%`)
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }

  if (filters.date_to) {
    /* Include the full end day by going to end-of-day */
    query = query.lte('created_at', `${filters.date_to}T23:59:59.999Z`)
  }

  if (filters.search) {
    const term = sanitiseLike(filters.search)
    query = query.or(
      `order_number.ilike.%${term}%,client_name.ilike.%${term}%`
    )
  }

  /* Pagination + ordering */
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error('Failed to fetch orders.')

  const total = count ?? 0

  return {
    items: (data ?? []) as iOrder[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/* Get one */
export async function getOrderById(id: string, businessId: string): Promise<iOrder> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (error || !data) {
    throw new Error('Order not found.')
  }

  return data as iOrder
}

/* Update
 * Returns both the old order (for audit log comparison) and the updated order.
 */
export async function updateOrder(
  id: string,
  dto: iUpdateOrderDTO,
  businessId: string
): Promise<{ previous: iOrder; updated: iOrder }> {
  /* Fetch current state first for the audit log */
  const previous = await getOrderById(id, businessId)

  /* Build the update payload with only the fields provided */
  const payload: Partial<iUpdateOrderDTO> = {}
  if (dto.client_name !== undefined) payload.client_name = dto.client_name.trim()
  if (dto.mineral_type !== undefined) payload.mineral_type = dto.mineral_type.trim()
  if (dto.quantity_kg !== undefined) payload.quantity_kg = dto.quantity_kg
  if (dto.unit_price_zar !== undefined) payload.unit_price_zar = dto.unit_price_zar
  if (dto.notes !== undefined) payload.notes = dto.notes.trim()
  if (dto.status !== undefined) payload.status = dto.status

  if (Object.keys(payload).length === 0) {
    throw new Error('No valid fields provided for update.')
  }

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) {
    throw new Error('Failed to update order.')
  }

  return { previous, updated: data as iOrder }
}

/* Cancel (soft delete) */
export async function cancelOrder(id: string, businessId: string): Promise<iOrder> {
  const current = await getOrderById(id, businessId)

  if (current.status === 'cancelled') {
    throw new Error('Order is already cancelled.')
  }

  if (current.status === 'delivered') {
    throw new Error('Delivered orders cannot be cancelled.')
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('business_id', businessId)
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) {
    throw new Error('Failed to cancel order.')
  }

  return data as iOrder
}

// Dashboard summary
export async function getOrderSummary(businessId: string): Promise<{
  total_today: number
  by_status: Record<string, number>
  total_value_active_zar: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const statuses: iOrderStatus[] = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']

  const [ todayResult, ...stautsResults ] = await Promise.all()
  /* Orders created today */
  const { count: total_today, error: todayErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', today.toISOString())

  if (todayErr) throw new Error('Failed to generate dashboard summary.')

  /* Count per status */
  const { data: statusData, error: statusErr } = await supabase
    .from('orders')
    .select('status')

  if (statusErr) throw new Error('Failed to generate dashboard summary.')

  const by_status: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
  }
  for (const row of statusData ?? []) {
    by_status[row.status] = (by_status[row.status] ?? 0) + 1
  }

  /* Total monetary value of non-cancelled, non-delivered orders */
  const { data: valueData, error: valueErr } = await supabase
    .from('orders')
    .select('total_zar')
    .in('status', ['pending', 'confirmed', 'dispatched'])

  if (valueErr) throw new Error('Failed to generate dashboard summary.')

  const total_value_active_zar = (valueData ?? []).reduce(
    (sum, row) => sum + Number(row.total_zar),
    0
  )

  return {
    total_today: total_today ?? 0,
    by_status,
    total_value_active_zar,
  }
}