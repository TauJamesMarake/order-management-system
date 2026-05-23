import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../types'
import { sendError } from '../utils/response'

// ─────────────────────────────────────────────────────────────
// Role Middleware — requireRole
//
// Factory function — returns a middleware that checks req.user.role
// against the allowed roles for that route.
// Must always run AFTER verifyToken (req.user must exist).
//
// USAGE:
//   router.delete('/:id', verifyToken, requireRole('admin'), handler)
// ─────────────────────────────────────────────────────────────

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthenticated. verifyToken must run first.', 401)
      return
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      sendError(
        res,
        `Access denied. Required: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
        403
      )
      return
    }

    next()
  }
}

// ─────────────────────────────────────────────────────────────
// requireOwnerOrAdmin
//
// Controller-level check (not route-level) because ownership
// requires knowing the resource's owner, which means a DB fetch first.
// Returns true if allowed, false if already responded with 403.
//
// USAGE (inside a controller):
//   const order = await getOrderById(id)
//   if (!requireOwnerOrAdmin(req, res, order.created_by)) return
// ─────────────────────────────────────────────────────────────

export function requireOwnerOrAdmin(
  req: Request,
  res: Response,
  resourceOwnerId: string
): boolean {
  if (!req.user) {
    sendError(res, 'Unauthenticated.', 401)
    return false
  }

  const isAdmin = req.user.role === 'admin'
  const isOwner = req.user.id   === resourceOwnerId

  if (!isAdmin && !isOwner) {
    sendError(res, 'Access denied. You can only modify your own orders.', 403)
    return false
  }

  return true
}