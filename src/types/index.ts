/**
 * Shared type definitions for the OMS API.
 *
 * ── Changes ───────────────────────────────────────────────────────────────
 * - iCreateUser and iUpdateUser (from types/iusers.ts) have been removed.
 *   They duplicated the shape already inferred by the Zod schemas in
 *   users.controller.ts and were a second source of truth that could drift.
 *   Use  z.infer<typeof CreateUserSchema>  in any place that previously
 *   imported those interfaces.
 *
 * - The Request augmentation (req.user) is kept in this file so it is
 *   available to every controller without an extra import.
 */

import { Request } from 'express'

/* ── User ───────────────────────────────────────────────────────────────── */

export type UserRole = 'admin' | 'clerk' | 'viewer'

export interface User {
  id:         string
  email:      string
  full_name:  string
  role:       UserRole
  is_active:  boolean
  created_at: string
}

/* ── Order ──────────────────────────────────────────────────────────────── */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id:             string
  order_number:   string
  client_name:    string
  mineral_type:   string
  quantity_kg:    number
  unit_price_zar: number
  total_zar:      number
  status:         OrderStatus
  notes:          string | null
  created_by:     string
  created_at:     string
  updated_at:     string
  creator?:       Pick<User, 'id' | 'full_name' | 'email'>
}

export interface CreateOrderDTO {
  client_name:    string
  mineral_type:   string
  quantity_kg:    number
  unit_price_zar: number
  notes?:         string
}

export interface UpdateOrderDTO {
  client_name?:    string
  mineral_type?:   string
  quantity_kg?:    number
  unit_price_zar?: number
  notes?:          string
  status?:         OrderStatus
}

/* ── Audit Log ──────────────────────────────────────────────────────────── */

export interface AuditLog {
  id:            string
  order_id:      string
  changed_by:    string
  field_changed: string
  old_value:     string | null
  new_value:     string | null
  changed_at:    string
  changer?:      Pick<User, 'id' | 'full_name' | 'email'>
}

/* ── API response shapes ────────────────────────────────────────────────── */

export interface ApiSuccess<T> {
  success: true
  data:    T
  message?: string
}

export interface ApiError {
  success: false
  error:   string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

/* ── Pagination ─────────────────────────────────────────────────────────── */

export interface PaginatedResult<T> {
  items:      T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

/* ── Order Filters ──────────────────────────────────────────────────────── */

export interface OrderFilters {
  /** Must be a member of the OrderStatus union — validated before use */
  status?:       OrderStatus
  mineral_type?: string
  client_name?:  string
  /** ISO-8601 date string YYYY-MM-DD — validated before use */
  date_from?:    string
  /** ISO-8601 date string YYYY-MM-DD — validated before use */
  date_to?:      string
  search?:       string
  page?:         number
  limit?:        number
}

/* ── Express Request augmentation ───────────────────────────────────────── */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id:    string
        email: string
        role:  UserRole
      }
    }
  }
}

/**
 * AuthenticatedRequest
 *
 * Use in controller and middleware signatures where verifyToken has already
 * run and user is guaranteed to be present.  Narrows req.user from optional
 * to required so call sites do not need the non-null assertion (!).
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id:    string
    email: string
    role:  UserRole
  }
}