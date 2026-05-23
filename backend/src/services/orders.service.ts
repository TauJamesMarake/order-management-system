import { supabase } from '../db/supabase'
import { generateOrderNumber } from '../utils/orderNumber'
import {
  Order,
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderFilters,
  PaginatedResult,
} from '../types'

// Create
export async function createOrder(
  dto: CreateOrderDTO,
  createdById: string
): Promise<Order> {
  const order_number = await generateOrderNumber()

  const { data, error } = await supabase
    .from('orders')
    .insert({
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

  if (error) throw new Error(`Failed to create order: ${error.message}`)
  return data as Order
}

// Get many (with filters + pagination)
export async function getOrders(
  filters: OrderFilters
): Promise<PaginatedResult<Order>> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Start query from the view which already joins creator details
  let query = supabase
    .from('v_orders_with_creator')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.mineral_type) {
    query = query.ilike('mineral_type', `%${filters.mineral_type}%`)
  }

  if (filters.client_name) {
    query = query.ilike('client_name', `%${filters.client_name}%`)
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }

  if (filters.date_to) {
    // Include the full end day by going to end of that day
    query = query.lte('created_at', `${filters.date_to}T23:59:59.999Z`)
  }

  // Search across order_number and client_name
  if (filters.search) {
    const term = filters.search.trim()
    query = query.or(
      `order_number.ilike.%${term}%,client_name.ilike.%${term}%`
    )
  }

  // Pagination + ordering
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(`Failed to fetch orders: ${error.message}`)

  const total = count ?? 0

  return {
    items: (data ?? []) as Order[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// Get one
export async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(`Order not found.`)
  }

  return data as Order
}

// Update
// Returns both the old order (for audit) and the updated order.
export async function updateOrder(
  id: string,
  dto: UpdateOrderDTO
): Promise<{ previous: Order; updated: Order }> {
  // Fetch current state first — needed for audit log comparison
  const previous = await getOrderById(id)

  // Build the update payload — only include fields actually provided
  const payload: Partial<UpdateOrderDTO> = {}
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
    throw new Error(`Failed to update order: ${error?.message}`)
  }

  return { previous, updated: data as Order }
}

// Cancel (soft delete)
export async function cancelOrder(id: string): Promise<Order> {
  const current = await getOrderById(id)

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
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) {
    throw new Error(`Failed to cancel order: ${error?.message}`)
  }

  return data as Order
}

// Dashboard summary
export async function getOrderSummary(): Promise<{
  total_today: number
  by_status: Record<string, number>
  total_value_active_zar: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Orders created today
  const { count: total_today, error: todayErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  if (todayErr) throw new Error(`Dashboard error: ${todayErr.message}`)

  // Count per status
  const { data: statusData, error: statusErr } = await supabase
    .from('orders')
    .select('status')

  if (statusErr) throw new Error(`Dashboard error: ${statusErr.message}`)

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

  // Total amount value of non-cancelled, non-delivered orders
  const { data: valueData, error: valueErr } = await supabase
    .from('orders')
    .select('total_zar')
    .in('status', ['pending', 'confirmed', 'dispatched'])

  if (valueErr) throw new Error(`Dashboard error: ${valueErr.message}`)

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
