import { Response } from 'express'
import { z } from 'zod'
import { iAuthenticatedRequest, iOrderFilters, OrderStatus } from '../types'
import { sendSuccess, sendError } from '../utils/response'
import { requireOwnerOrAdmin } from '../middleware/role.middleware'
import * as OrdersService from '../services/orders.service'
import * as AuditService from '../services/audit.service'

/**
 * Orders Controller
 *
 * Responsibilities:
 *  - Validate and sanitise HTTP inputs (Zod schemas).
 *  - Enforce ownership checks at the controller level where resource context
 *    is required (i.e. after a DB fetch).
 *  - Delegate all data access to the service layer.
 *  - Return only client-safe error messages — never DB / Supabase internals.
 */

/* Validation schemas */
const VALID_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled',
]

/** ISO-8601 date string YYYY-MM-DD */
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(v => !isNaN(new Date(v).getTime()), 'Invalid date')

const CreateOrderSchema = z.object({
  client_name: z.string().min(2).max(255),
  mineral_type: z.string().min(2).max(100),
  quantity_kg: z.number().positive(),
  unit_price_zar: z.number().positive(),
  notes: z.string().max(1000).optional(),
})

const UpdateOrderSchema = z
  .object({
    client_name: z.string().min(2).max(255).optional(),
    mineral_type: z.string().min(2).max(100).optional(),
    quantity_kg: z.number().positive().optional(),
    unit_price_zar: z.number().positive().optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']).optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  })

/* Shared helpers
 * Parses and validates the status query parameter.
 */
function parseStatusFilter(raw: unknown): OrderStatus | undefined {
  if (typeof raw !== 'string') return undefined
  return VALID_STATUSES.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : undefined
}

/*
 * Parses and validates a date query parameter.
 * Returns the string if valid, undefined otherwise.
 * The caller receives a string it can safely pass to .gte() / .lte().
 */
function parseDateFilter(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const result = DateStringSchema.safeParse(raw)
  return result.success ? result.data : undefined
}

// POST /api/orders
export async function createOrder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    // const order = await OrdersService.createOrder(parsed.data, req.user.id, req.user.business_id)
    const order = await OrdersService.createOrder(parsed.data, req.user.id, '')

    // Audit log
    await AuditService.logOrderCreated(order.id, req.user.id, order.order_number)

    sendSuccess(res, order, 'Order created successfully.', 201)
  } catch (err) {
    console.error('[createOrder]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to create order.', status)
  }
}

// GET /api/orders

/**
 * Returns a paginated, filtered list of orders.
 *
 * Access: all authenticated roles (admin, clerk, viewer).
 * Viewers have read-only access to all orders — this is an intentional
 * business decision (they are internal staff who need visibility but cannot
 * mutate).  If per-user scoping is required in future, add a  created_by
 * filter here conditional on role === 'viewer'.
 */
export async function getOrders(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const filters: iOrderFilters = {
      status: parseStatusFilter(req.query.status),
      mineral_type: typeof req.query.mineral_type === 'string' ? req.query.mineral_type : undefined,
      client_name: typeof req.query.client_name === 'string' ? req.query.client_name : undefined,
      date_from: parseDateFilter(req.query.date_from),
      date_to: parseDateFilter(req.query.date_to),
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    }

    const result = await OrdersService.getOrders(filters)
    sendSuccess(res, result)
  } catch (err) {
    console.error('[getOrders]', err)
    sendError(res, 'Failed to fetch orders.', 500)
  }
}

// GET /api/orders/summary

export async function getOrderSummary(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const summary = await OrdersService.getOrderSummary()
    sendSuccess(res, summary)
  } catch (err) {
    console.error('[getOrderSummary]', err)
    sendError(res, 'Failed to fetch order summary.', 500)
  }
}

/* GET /api/orders/:id */

export async function getOrderById(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const order = await OrdersService.getOrderById(id)
    sendSuccess(res, order)
  } catch (err) {
    console.error('[getOrderById]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to fetch order.', status)
  }
}

// GET /api/orders/:id/audit
export async function getOrderAuditLog(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    // Confirm order exists before fetching the audit trail
    await OrdersService.getOrderById(id)

    const logs = await AuditService.getAuditLogsForOrder(id)
    sendSuccess(res, logs)
  } catch (err) {
    console.error('[getOrderAuditLog]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to fetch audit log.', status)
  }
}

// PATCH /api/orders/:id

export async function updateOrder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const parsed = UpdateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    const current = await OrdersService.getOrderById(id)

    // Ownership check, admin can edit any order; clerk only their own
    if (!requireOwnerOrAdmin(req, res, current.created_by)) return

    // Business rule guards
    if (current.status === 'cancelled') {
      sendError(res, 'Cancelled orders cannot be edited.', 400)
      return
    }

    if (current.status === 'delivered') {
      sendError(res, 'Delivered orders cannot be edited.', 400)
      return
    }

    const { previous, updated } = await OrdersService.updateOrder(id, parsed.data)

    await AuditService.logOrderChanges(id, req.user.id, previous, updated)

    sendSuccess(res, updated, 'Order updated successfully.')
  } catch (err) {
    console.error('[updateOrder]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to update order.', status)
  }
}

// PATCH /api/orders/:id/cancel
export async function cancelOrder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const current = await OrdersService.getOrderById(id)

    if (!requireOwnerOrAdmin(req, res, current.created_by)) return

    const cancelled = await OrdersService.cancelOrder(id)

    await AuditService.logOrderCancelled(id, req.user.id, current.status)

    sendSuccess(res, cancelled, 'Order cancelled successfully.')
  } catch (err) {
    console.error('[cancelOrder]', err)
    const status =
      err instanceof Error && err.message.includes('not found')
        ? 404
        : err instanceof Error && err.message.includes('Delivered')
          ? 400
          : 500
    sendError(res, 'Failed to cancel order.', status)
  }
}