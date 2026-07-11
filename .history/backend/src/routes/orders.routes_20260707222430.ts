import { Router, RequestHandler } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as OrdersController from '../controllers/orders.controller'
// import { iAuthenticatedRequest } from '../types'

// ROLE RULES (from SRS):
//   GET    /orders            → all authenticated (admin, clerk, viewer)
//   GET    /orders/summary    → all authenticated
//   GET    /orders/:id        → all authenticated
//   GET    /orders/:id/audit  → admin only
//   POST   /orders            → admin, clerk
//   PATCH  /orders/:id        → admin, clerk (ownership enforced in controller)
//   PATCH  /orders/:id/cancel → admin, clerk (ownership enforced in controller)

const router = Router()

// Dashboard summary
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

// Audit trail, admin only
router.get('/:id/audit',
  verifyToken as RequestHandler,
  requireRole('admin') as RequestHandler,
  OrdersController.getOrderAuditLog as RequestHandler
)

// CREATE ORDER
router.post('/',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.createOrder as RequestHandler
)

// UPDATE ORDER FIELDS
router.patch('/:id',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.updateOrder as RequestHandler
)

// CANCEL ORDER
router.patch('/:id/cancel',
  verifyToken as RequestHandler,
  requireRole('admin', 'clerk') as RequestHandler,
  OrdersController.cancelOrder as RequestHandler
)

export default router