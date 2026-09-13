import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../types'
import { sendError } from '../utils/response'

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
  const isOwner = req.user.id === resourceOwnerId

  if (!isAdmin && !isOwner) {
    sendError(res, 'Access denied. You can only modify your own orders.', 403)
    return false
  }

  return true
}