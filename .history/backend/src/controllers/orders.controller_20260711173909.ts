import { Response } from 'express'
import { z } from 'zod'
import { iAuthenticatedRequest, iOrderFilters } from '../types'
import { sendSuccess, sendError } from '../utils/response'
import { requireOwnerOrAdmin } from '../middleware/role.middleware'
import * as OrdersService from '../services/orders.service'
import * as AuditService from '../services/audit.service'

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
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  })

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

    const order = await OrdersService.createOrder(
      parsed.data,
      req.user.id,
      req.user.business_id,
    )

    await AuditService.logOrderCreated(order.id, req.user.id, order.order_number)

    sendSuccess(res, order, 'Order created successfully.', 201)
  } catch (err) {
    console.error('[createOrder]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to create order.', status)
  }
}

// GET /api/orders
export async function getOrders(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const filters: iOrderFilters = {
      status: req.query.status as string | undefined as any,
      mineral_type: req.query.mineral_type as string | undefined,
      client_name: req.query.client_name as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      search: req.query.search as string | undefined,
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

// GET /api/orders/:id
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
    await OrdersService.getOrderById(id)    // confirms order exists
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

    if (!requireOwnerOrAdmin(req, res, current.created_by)) return

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
      err instanceof Error && err.message.includes('not found') ? 404
        : err instanceof Error && err.message.includes('Delivered') ? 400
          : 500
    sendError(res, 'Failed to cancel order.', status)
  }
}