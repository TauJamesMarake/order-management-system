import { Request } from 'express'

// Roles
export type UserRole = 'admin' | 'clerk' | 'viewer'

// User
export interface iUser {
  id: string
  business_id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface iPlatformAdmin {\
  id: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface iOrder {
  id: string
  business_id: string
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

export interface iAuditLog {
  id: string
  business_id: string
  order_id: string
  changed_by: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changer?: Pick<iUser, 'id' | 'full_name' | 'email'>
}

// API Responses
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

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: UserRole
        business_id: string
      }
      platformAdmin?: {
        id: string
        email: string
      }
    }
  }
}

// AuthenticatedRequest
export interface iAuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    role: UserRole
    business_id: string
  }
}

// PlatformAuthenticatedRequest
// Use in platform admin controllers where req.platformAdmin is guaranteed.
export interface iPlatformAuthenticatedRequest extends Request {
  platformAdmin: {
    id: string
    email: string
  }
}