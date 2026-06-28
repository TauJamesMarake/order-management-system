export type UserRole = 'admin' | 'clerk' | 'viewer'

export interface iUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface iAuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
}

export interface iLoginCredentials {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  refresh_token: string
  user: iAuthUser
}

// Orders

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
  // Joined from view
  creator_id?: string
  creator_name?: string
  creator_email?: string
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

export interface iOrderFilters {
  status?: OrderStatus
  mineral_type?: string
  client_name?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

// Audit

// Type aliases for compatibility
export type User = iAuthUser
export type Order = iOrder
export type AuthUser = iAuthUser

export interface iAuditLog {
  id: string
  order_id: string
  changed_by: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changer?: {
    id: string
    full_name: string
    email: string
  }
}

// Reports

export interface iOrderSummary {
  total_orders: number
  total_value_zar: number
  total_qty_kg: number
  by_status: Record<OrderStatus, number>
  by_mineral: Record<string, { count: number; value: number }>
  filters_applied: {
    date_from: string | null
    date_to: string | null
    status: OrderStatus | null
    mineral_type: string | null
  }
}

export interface iDashboardSummary {
  total_today: number
  by_status: Record<OrderStatus, number>
  total_value_active_zar: number
}

// API Response wrappers

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

export interface iPaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// UI-only helpers

/** Nullable version of any type — useful for form defaults */
export type Nullable<T> = T | null

/** All keys of T become optional + nullable */
export type PartialNullable<T> = { [K in keyof T]?: T[K] | null }