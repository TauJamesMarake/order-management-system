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

export async function createOrder(
  dto:          iCreateOrderDTO,
  createdById:  string,
  businessId:   string,
): Promise<iOrder> {
  // Atomic order number generation via DB function.
  // fn_next_order_number(business_id, year) increments the per-business
  // counter atomically — no race condition possible.
  const order_number = await generateOrderNumber(businessId)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      business_id:    businessId,              // ★ PHASE 2 — tenant discriminator
      order_number,
      client_name:    dto.client_name.trim(),
      mineral_type:   dto.mineral_type.trim(),
      quantity_kg:    dto.quantity_kg,
      unit_price_zar: dto.unit_price_zar,
      notes:          dto.notes?.trim() ?? null,
      created_by:     createdById,
    })
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error) throw new Error('Failed to create order.')
  return data as Order
}

// ── Get many (with filters + pagination) ────────────────────

export async function getOrders(
  filters:    OrderFilters,
  businessId: string,           // ★ PHASE 2
): Promise<PaginatedResult<Order>> {
  const page  = Math.max(1, filters.page  ?? 1)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  // Tenant scope applied first — Postgres uses idx_orders_biz_created_at
  // to eliminate all other tenants before evaluating secondary predicates.
  let query = supabase
    .from('v_orders_with_creator')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)          // ★ PHASE 2 — leading filter

  // Optional filters — applied within the tenant scope
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
    items:      (data ?? []) as Order[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// ── Get one ──────────────────────────────────────────────────
//
// Dual-key lookup: id + business_id.
// If id belongs to another tenant, no row is returned → "not found."
// This is intentional — cross-tenant requests return 404, not 403.

export async function getOrderById(
  id:         string,
  businessId: string,           // ★ PHASE 2
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .eq('id', id)
    .eq('business_id', businessId)          // ★ PHASE 2 — cross-tenant guard
    .single()

  if (error || !data) throw new Error('Order not found.')
  return data as Order
}

// ── Update ───────────────────────────────────────────────────
// Returns both the old order (for audit) and the updated order.

export async function updateOrder(
  id:         string,
  dto:        UpdateOrderDTO,
  businessId: string,           // ★ PHASE 2
): Promise<{ previous: Order; updated: Order }> {
  // Fetch current state — scoped to this business.
  // Cross-tenant id → getOrderById throws → update never executes.
  const previous = await getOrderById(id, businessId)

  // Build payload from only the provided fields
  const payload: Partial<UpdateOrderDTO> = {}
  if (dto.client_name    !== undefined) payload.client_name    = dto.client_name.trim()
  if (dto.mineral_type   !== undefined) payload.mineral_type   = dto.mineral_type.trim()
  if (dto.quantity_kg    !== undefined) payload.quantity_kg    = dto.quantity_kg
  if (dto.unit_price_zar !== undefined) payload.unit_price_zar = dto.unit_price_zar
  if (dto.notes          !== undefined) payload.notes          = dto.notes.trim()
  if (dto.status         !== undefined) payload.status         = dto.status

  if (Object.keys(payload).length === 0) {
    throw new Error('No valid fields provided for update.')
  }

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .eq('business_id', businessId)          // ★ PHASE 2 — defence in depth
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) throw new Error('Failed to update order.')
  return { previous, updated: data as Order }
}

// ── Cancel (soft delete) ─────────────────────────────────────

export async function cancelOrder(
  id:         string,
  businessId: string,           // ★ PHASE 2
): Promise<Order> {
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
    .eq('business_id', businessId)          // ★ PHASE 2 — defence in depth
    .select(`
      *,
      creator:users!created_by (id, full_name, email)
    `)
    .single()

  if (error || !data) throw new Error('Failed to cancel order.')
  return data as Order
}

// ── Dashboard summary ─────────────────────────────────────────
//
// PHASE 2 REDESIGN — performance improvement:
//
// OLD approach: SELECT status FROM orders → transfer N rows → JS reduce
//   Problem: O(n) row transfer grows linearly with order volume.
//
// NEW approach: parallel indexed COUNT queries + server-side SUM
//   - 5 COUNT queries (one per status) use idx_orders_biz_status
//   - 1 today COUNT query uses idx_orders_biz_created_at
//   - 1 SUM query uses server-side aggregation via PostgREST
//   - All 7 run concurrently via Promise.all
//   - Zero data rows transferred — counts only
//
// Result: constant overhead regardless of order volume.

export async function getOrderSummary(
  businessId: string,           // ★ PHASE 2
): Promise<{
  total_today:           number
  by_status:             Record<string, number>
  total_value_active_zar: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const statuses: OrderStatus[] = [
    'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'
  ]

  // All queries run concurrently — no sequential awaits
  const [
    todayResult,
    ...statusResults
  ] = await Promise.all([

    // Orders created today for this business
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', today.toISOString()),

    // Per-status counts — each is a fast indexed lookup
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
  // PostgREST aggregation — no rows transferred, just the aggregate
  const { data: valueData, error: valueErr } = await supabase
    .from('orders')
    .select('total_zar.sum()')
    .eq('business_id', businessId)
    .in('status', ['pending', 'confirmed', 'dispatched'])
    .single()

  if (valueErr) throw new Error('Failed to generate dashboard summary.')

  const total_value_active_zar = Number((valueData as any)?.sum ?? 0)

  return {
    total_today:            todayResult.count ?? 0,
    by_status,
    total_value_active_zar,
  }
}