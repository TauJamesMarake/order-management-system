import { Request } from 'express'

export type UserRole = 'admin' | 'clerk' | 'viewer'

export interface iUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

/* Order */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface iOrder {
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
  creator?: Pick<iUser, 'id' | 'full_name' | 'email'>
}

export interface iCreateOrderDTO {
  client_name: string
  mineral_type: string
  quantity_kg: number
  unit_price_zar: number
  notes?: string
}

export interface iUpdateOrderDTO {
  client_name?: string
  mineral_type?: string
  quantity_kg?: number
  unit_price_zar?: number
  notes?: string
  status?: OrderStatus
}

/* Audit Log */
export interface iAuditLog {
  id: string
  order_id: string
  changed_by: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changer?: Pick<iUser, 'id' | 'full_name' | 'email'>
}

/* API response shapes */
export interface iApiSuccess<T> {
  success: true
  data: T
  message?: string
}

export interface iApiError {
  success: false
  error: string
  details?: unknown
}

export type ApiResponse<T> = iApiSuccess<T> | iApiError

/* Pagination */
export interface iPaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/* Order Filters */
export interface iOrderFilters {
  status?: OrderStatus
  mineral_type?: string
  client_name?: string
  /** ISO-8601 date string YYYY-MM-DD — validated before use */
  date_from?: string
  /** ISO-8601 date string YYYY-MM-DD — validated before use */
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

/* Express Request augmentation */
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

export interface iAuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    role: UserRole
  }
}