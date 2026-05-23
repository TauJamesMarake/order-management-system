import { Router, RequestHandler } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as OrdersController from '../controllers/orders.controller'
import { AuthenticatedRequest } from '../types'

// WHY THE `as RequestHandler` CAST:
//   Our controllers use AuthenticatedRequest (extends Request with
//   req.user attached). Express Router typings expect the base
//   Request type — it does not know about our extension.
//   Casting to RequestHandler tells TypeScript "trust us, this is
//   compatible" — which it is at runtime because verifyToken
//   always runs first and attaches req.user before any controller fires.
//
// ROLE RULES (from SRS):
//   GET    /orders            → all authenticated (admin, clerk, viewer)
//   GET    /orders/summary    → all authenticated
//   GET    /orders/:id        → all authenticated
//   GET    /orders/:id/audit  → admin only
//   POST   /orders            → admin, clerk
//   PATCH  /orders/:id        → admin, clerk (ownership enforced in controller)
//   PATCH  /orders/:id/cancel → admin, clerk (ownership enforced in controller)

const router = Router()

// Dashboard summary — defined BEFORE /:id so Express does not
// match the string "summary" as an :id parameter
router.get('/summary',
  verifyToken as RequestHandler,
  OrdersController.getOrderSummary as RequestHandler
)

// Paginated order list with filters
router.get('/',
  verifyToken as RequestHandler,
  OrdersController.getOrders as RequestHandler
)

// Single order by id
router.get('/:id',
  verifyToken as RequestHandler,
  OrdersController.getOrderById as RequestHandler
)

// Audit trail — admin only
router.get('/:id/audit',
  verifyToken as RequestHandler,
  requireRole('admin') as RequestHandler,
  OrdersController.getOrderAuditLog as RequestHandler
)

// Create order
router.post('/',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.createOrder as RequestHandler
)

// Update order fields
router.patch('/:id',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.updateOrder as RequestHandler
)

// Cancel order — separate endpoint, explicit intent
router.patch('/:id/cancel',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.cancelOrder as RequestHandler
)

export default router