import type { UserRole } from '@/types'

export const ROLE_HOME_PATH: Record<UserRole, string> = {
  admin: '/dashboard',
  clerk: '/dashboard',
  viewer: '/customers',
}

export const PAGE_ACCESS: Record<string, readonly UserRole[]> = {
  '/dashboard': ['admin', 'clerk'],
  '/orders': ['admin', 'clerk'],
  '/reports': ['admin'],
  '/customers': ['admin', 'clerk', 'viewer'],
  '/users': ['admin'],
  '/notifications': ['admin', 'clerk'],
}

export function canAccessPage(role: UserRole | null | undefined, path: string): boolean {
  return role !== null && role !== undefined && (PAGE_ACCESS[path]?.includes(role) ?? false)
}
