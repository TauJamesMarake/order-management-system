import { Router, RequestHandler } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as NotificationsController from '../controllers/notifications.controller'

// ROLE RULES:
//   All routes → admin, clerk only.
//   Notifications are operational alerts for staff who action orders —
//   same gating Notifications.tsx already applies client-side; this is
//   just the server-side enforcement of it. Viewers get a real 403,
//   not a filtered/empty feed.

const router = Router()

// Aggregated feed: order-derived items (minus dismissed) + reminders
router.get('/',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.getNotifications as RequestHandler
)

// CREATE reminder
router.post('/reminders',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.createReminder as RequestHandler
)

// UPDATE reminder title/detail
router.patch('/reminders/:id',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.updateReminder as RequestHandler
)

// TOGGLE reminder done state
router.patch('/reminders/:id/toggle',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.toggleReminder as RequestHandler
)

// DELETE reminder
router.delete('/reminders/:id',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.deleteReminder as RequestHandler
)

// DISMISS an order-derived (virtual) notification, by key
router.post('/dismiss',
    verifyToken as RequestHandler,
    requireRole('admin', 'clerk') as RequestHandler,
    NotificationsController.dismissNotification as RequestHandler
)

export default router