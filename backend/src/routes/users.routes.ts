import { Router } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as UsersController from '../controllers/users.controller'

// ─────────────────────────────────────────────────────────────
// Users Routes
//
// All routes require authentication.
// Admin-only routes use requireRole('admin').
// GET /:id and PATCH /:id allow any authenticated user —
// ownership enforcement is handled inside the controller.
// ─────────────────────────────────────────────────────────────

const router = Router()

// All authenticated users
router.get('/:id', verifyToken, UsersController.getUserById)
router.patch('/:id', verifyToken, UsersController.updateUser)

// Admin only
router.get('/', verifyToken, requireRole('admin'), UsersController.getUsers)
router.post('/', verifyToken, requireRole('admin'), UsersController.createUser)
router.patch('/:id/deactivate', verifyToken, requireRole('admin'), UsersController.deactivateUser)
router.patch('/:id/reactivate', verifyToken, requireRole('admin'), UsersController.reactivateUser)

export default router