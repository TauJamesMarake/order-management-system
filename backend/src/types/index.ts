export type UserRole = 'admin' | 'clerk' | 'viewer'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

// Order
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id: string
  order_number: string
  client_name: string
  mineral_type: string
  quantity_kg: number
  unit_price_zar: number
  total_zar: number
  status: OrderStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  creator?: Pick<User, 'id' | 'full_name' | 'email'>
}

export interface CreateOrderDTO {
  client_name: string
  mineral_type: string
  quantity_kg: number
  unit_price_zar: number
  notes?: string
}

export interface UpdateOrderDTO {
  client_name?: string
  mineral_type?: string
  quantity_kg?: number
  unit_price_zar?: number
  notes?: string
  status?: OrderStatus
}

// Audit Log
export interface AuditLog {
  id: string
  order_id: string
  changed_by: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changer?: Pick<User, 'id' | 'full_name' | 'email'>
}

// API Responses
export interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

export interface ApiError {
  success: false
  error: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// Pagination
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Order Filters
export interface OrderFilters {
  status?: OrderStatus
  mineral_type?: string
  client_name?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

// ── Express global augmentation ──────────────────────────────
// Augmenting Express's namespace globally means every req object
// gets a user property without needing a cast on each handler.
// user is optional here because it is only set AFTER verifyToken runs.
import { Request } from 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: UserRole
      }
    }
  }
}

// AuthenticatedRequest keeps user non-optional.
// Use it only in middleware signatures (auth + role) where
// you want TypeScript to enforce that user is guaranteed present.
export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    role: UserRole
  }
}