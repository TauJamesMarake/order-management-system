// ─────────────────────────────────────────────────────────────
// types/index.ts
//
// PHASE 1 CHANGES:
//   • User interface       — added business_id
//   • Express req.user     — added business_id
//   • AuthenticatedRequest — added business_id
//   • Express req.platformAdmin — NEW (platform admin routes)
//   • PlatformAdmin interface   — NEW
// ─────────────────────────────────────────────────────────────

import { Request } from 'express'

// ── Roles ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'clerk' | 'viewer'

// ── User ─────────────────────────────────────────────────────
export interface User {
  id:          string
  business_id: string    // ★ PHASE 1 — tenant discriminator
  email:       string
  full_name:   string
  role:        UserRole
  is_active:   boolean
  created_at:  string
}

// ── Platform Admin ───────────────────────────────────────────
// Lives in platform_admins table, not users.
// Authenticated via /api/platform/auth/login.
export interface PlatformAdmin {
  id:         string
  email:      string
  full_name:  string
  is_active:  boolean
  created_at: string
}

// ── Order ─────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id:             string
  business_id:    string    // ★ PHASE 1 — tenant discriminator
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

// ── Audit Log ────────────────────────────────────────────────
export interface AuditLog {
  id:            string
  business_id:   string    // ★ PHASE 1 — tenant discriminator
  order_id:      string
  changed_by:    string
  field_changed: string
  old_value:     string | null
  new_value:     string | null
  changed_at:    string
  changer?:      Pick<User, 'id' | 'full_name' | 'email'>
}

// ── API Responses ────────────────────────────────────────────
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

// ── Pagination ───────────────────────────────────────────────
export interface PaginatedResult<T> {
  items:      T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

// ── Order Filters ────────────────────────────────────────────
export interface OrderFilters {
  status?:       OrderStatus
  mineral_type?: string
  client_name?:  string
  date_from?:    string
  date_to?:      string
  search?:       string
  page?:         number
  limit?:        number
}

// ────────────────────────────────────────────────────────────
// Express augmentations
//
// req.user        — set by verifyToken       (business routes)
// req.platformAdmin — set by verifyPlatformToken (platform routes)
//
// These are intentionally kept SEPARATE. A platform admin
// never has req.user; a business user never has req.platformAdmin.
// ────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id:          string
        email:       string
        role:        UserRole
        business_id: string    // ★ PHASE 1 — always from DB, never from client
      }
      platformAdmin?: {
        id:    string
        email: string
      }
    }
  }
}

// ── AuthenticatedRequest ─────────────────────────────────────
// Use in controllers/middleware where req.user is guaranteed present.
// Non-optional — TypeScript enforces it.
export interface AuthenticatedRequest extends Request {
  user: {
    id:          string
    email:       string
    role:        UserRole
    business_id: string    // ★ PHASE 1
  }
}

// ── PlatformAuthenticatedRequest ─────────────────────────────
// Use in platform admin controllers where req.platformAdmin is guaranteed.
export interface PlatformAuthenticatedRequest extends Request {
  platformAdmin: {
    id:    string
    email: string
  }
}