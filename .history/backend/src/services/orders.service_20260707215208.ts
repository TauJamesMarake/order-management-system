import { supabase } from '../db/supabase'
import { generateOrderNumber } from '../utils/orderNumber'
import {
  iOrder,
  OrderStatus,
  iCreateOrderDTO,
  iUpdateOrderDTO,
  iOrderFilters,
  iPaginatedResult,
} from '../types'

export async function createOrder(
  dto: iCreateOrderDTO,
  createdById: string,
  businessId: string,
): Promise<iOrder> {

  const order_number = await generateOrderNumber(businessId)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      business_id: businessId,
      order_number,
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

// Get many
export async function getOrders(
  filters: iOrderFilters,
  businessId: string,           // ★ PHASE 2
): Promise<iPaginatedResult<iOrder>> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('v_orders_with_creator')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)

  // Optional filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.mineral_type) {
    // Sanitised — special chars in ILIKE patterns are escaped upstream
    query = query.ilike('mineral_type', `%${filters.mineral_type}%`)
  }

  if (filters.client_name) {
    query = query.ilike('client_name', `%${filters.client_name}%`)
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte('created_at', `${filters.date_to}T23:59:59.999Z`)
  }

  // Cross-column search within this tenant's rows only
  if (filters.search) {
    const term = filters.search.trim()
    query = query.or(
      `order_number.ilike.%${term}%,client_name.ilike.%${term}%`
    )
  }

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

// Get one
export async function getOrderById(
  id: string,
  businessId: string,
): Promise<iOrder> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (error || !data) throw new Error('Order not found.')
  return data as iOrder
}

// Update
export async function updateOrder(
  id: string,
  dto: iUpdateOrderDTO,
  businessId: string,
): Promise<{ previous: iOrder; updated: iOrder }> {

  const previous = await getOrderById(id, businessId)

  // Build payload from only the provided fields
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
    .eq('business_id', businessId)
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) throw new Error('Failed to update order.')
  return { previous, updated: data as iOrder }
}

// Cancel (soft delete)
export async function cancelOrder(
  id: string,
  businessId: string,
): Promise<iOrder> {
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

  if (error || !data) throw new Error('Failed to cancel order.')
  return data as iOrder
}

// Dashboard summary
export async function getOrderSummary(
  businessId: string,
): Promise<{
  total_today: number
  by_status: Record<string, number>
  total_value_active_zar: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const statuses: OrderStatus[] = [
    'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'
  ]

  const [
    todayResult,
    ...statusResults
  ] = await Promise.all([

    // Orders created the current day for the business
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', today.toISOString()),

    // Per-status counts
    ...statuses.map(status =>
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', status)
    ),
  ])

  if (todayResult.error) throw new Error('Failed to generate dashboard summary.')

  // Build by_status map from parallel count results
  const by_status: Record<string, number> = {}
  statuses.forEach((status, i) => {
    const result = statusResults[i]
    if (result.error) throw new Error('Failed to generate dashboard summary.')
    by_status[status] = result.count ?? 0
  })

  // Server-side SUM of active order values
  const { data: valueData, error: valueErr } = await supabase
    .from('orders')
    .select('total_zar.sum()')
    .eq('business_id', businessId)
    .in('status', ['pending', 'confirmed', 'dispatched'])
    .single()

  if (valueErr) throw new Error('Failed to generate dashboard summary.')

  const total_value_active_zar = Number((valueData as any)?.sum ?? 0)

  return {
    total_today: todayResult.count ?? 0,
    by_status,
    total_value_active_zar,
  }
}