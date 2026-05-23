import { Response } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest, OrderFilters } from '../types'
import { sendSuccess, sendError } from '../utils/response'
import { requireOwnerOrAdmin } from '../middleware/role.middleware'
import * as OrdersService from '../services/orders.service'
import * as AuditService  from '../services/audit.service'

//
// RESPONSIBILITY:
//   - Parse and validate request inputs (using zod schemas)
//   - Call the appropriate service function
//   - Return a structured HTTP response
//   - Handle all errors from the service layer
//

const CreateOrderSchema = z.object({
  client_name:    z.string().min(2,  'Client name must be at least 2 characters.').max(255),
  mineral_type:   z.string().min(2,  'Mineral type must be at least 2 characters.').max(100),
  quantity_kg:    z.number().positive('Quantity must be a positive number.'),
  unit_price_zar: z.number().positive('Unit price must be a positive number.'),
  notes:          z.string().max(1000).optional(),
})

const UpdateOrderSchema = z.object({
  client_name:    z.string().min(2).max(255).optional(),
  mineral_type:   z.string().min(2).max(100).optional(),
  quantity_kg:    z.number().positive().optional(),
  unit_price_zar: z.number().positive().optional(),
  notes:          z.string().max(1000).optional(),
  status:         z.enum(['pending','confirmed','dispatched','delivered','cancelled']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update.' }
)

// POST /api/orders
export async function createOrder(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    // Validate request body
    const parsed = CreateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    // Create order, service generates the order number
    const order = await OrdersService.createOrder(parsed.data, req.user.id)

    // Write audit log, non-blocking
    await AuditService.logOrderCreated(order.id, req.user.id, order.order_number)

    sendSuccess(res, order, 'Order created successfully.', 201)
  } catch (err) {
    console.error('[createOrder]', err)
    sendError(res, err instanceof Error ? err.message : 'Failed to create order.')
  }
}

// GET /api/orders
export async function getOrders(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    // Parse query params — all optional
    const filters: OrderFilters = {
      status:       req.query.status       as string | undefined as any,
      mineral_type: req.query.mineral_type as string | undefined,
      client_name:  req.query.client_name  as string | undefined,
      date_from:    req.query.date_from    as string | undefined,
      date_to:      req.query.date_to      as string | undefined,
      search:       req.query.search       as string | undefined,
      page:         req.query.page  ? parseInt(req.query.page  as string, 10) : 1,
      limit:        req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    }

    const result = await OrdersService.getOrders(filters)
    sendSuccess(res, result)
  } catch (err) {
    console.error('[getOrders]', err)
    sendError(res, 'Failed to fetch orders.')
  }
}

// GET /api/orders/summary
export async function getOrderSummary(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const summary = await OrdersService.getOrderSummary()
    sendSuccess(res, summary)
  } catch (err) {
    console.error('[getOrderSummary]', err)
    sendError(res, 'Failed to fetch order summary.')
  }
}

// GET /api/orders/:id
export async function getOrderById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const order = await OrdersService.getOrderById(id)
    sendSuccess(res, order)
  } catch (err) {
    console.error('[getOrderById]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch order.'
    const status  = message.includes('not found') ? 404 : 500
    sendError(res, message, status)
  }
}

// GET /api/orders/:id/audit
export async function getOrderAuditLog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    // Confirm order exists first
    await OrdersService.getOrderById(id)
    const logs = await AuditService.getAuditLogsForOrder(id)
    sendSuccess(res, logs)
  } catch (err) {
    console.error('[getOrderAuditLog]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch audit log.'
    const status  = message.includes('not found') ? 404 : 500
    sendError(res, message, status)
  }
}

// PATCH /api/orders/:id
export async function updateOrder(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    // Validate body
    const parsed = UpdateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    // Fetch current order to check ownership
    const current = await OrdersService.getOrderById(id)

    // Enforce ownership: only creator or admin may edit
    if (!requireOwnerOrAdmin(req, res, current.created_by)) return

    // Block editing of cancelled or delivered orders
    if (current.status === 'cancelled') {
      sendError(res, 'Cancelled orders cannot be edited.', 400)
      return
    }
    if (current.status === 'delivered') {
      sendError(res, 'Delivered orders cannot be edited.', 400)
      return
    }

    // Perform update
    const { previous, updated } = await OrdersService.updateOrder(id, parsed.data)

    // Write audit log for every changed field
    await AuditService.logOrderChanges(id, req.user.id, previous, updated)

    sendSuccess(res, updated, 'Order updated successfully.')
  } catch (err) {
    console.error('[updateOrder]', err)
    const message = err instanceof Error ? err.message : 'Failed to update order.'
    const status  = message.includes('not found') ? 404 : 500
    sendError(res, message, status)
  }
}

// PATCH /api/orders/:id/cancel
// Separate endpoint for cancellation, makes intent explicit.
// A clerk cannot accidentally cancel by patching status directly.
export async function cancelOrder(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    // Fetch to check ownership + current status
    const current = await OrdersService.getOrderById(id)

    // Only creator or admin can cancel
    if (!requireOwnerOrAdmin(req, res, current.created_by)) return

    // Cancel (service enforces business rules)
    const cancelled = await OrdersService.cancelOrder(id)

    // Audit
    await AuditService.logOrderCancelled(id, req.user.id, current.status)

    sendSuccess(res, cancelled, 'Order cancelled successfully.')
  } catch (err) {
    console.error('[cancelOrder]', err)
    const message = err instanceof Error ? err.message : 'Failed to cancel order.'
    const status  = message.includes('not found') ? 404
                  : message.includes('cannot')    ? 400
                  : 500
    sendError(res, message, status)
  }
}
