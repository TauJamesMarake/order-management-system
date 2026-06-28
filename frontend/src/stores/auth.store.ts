import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type iAuthUser, type UserRole } from '@/types'

export const TOKEN_KEY = 'oms_access_token'

interface iAuthState {
  user: iAuthUser | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  /** Called after a successful /auth/login response */
  setAuth: (user: iAuthUser, token: string) => void
  /** Called on logout or 401 */
  clearAuth: () => void
  /** Alias for clearAuth */
  logout: () => void
  /** Convenience: check if the current user has a given role */
  hasRole: (...roles: UserRole[]) => boolean
}

export const useAuthStore = create<iAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        // Keep localStorage in sync for the Axios interceptor
        localStorage.setItem(TOKEN_KEY, token)
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem(TOKEN_KEY)
        set({ user: null, token: null, isAuthenticated: false })
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        set({ user: null, token: null, isAuthenticated: false })
      },

      hasRole: (...roles) => {
        const { user } = get()
        return user !== null && roles.includes(user.role)
      },
    }),
    {
      name: 'oms_auth',           // localStorage key for the persisted slice
      storage: createJSONStorage(() => localStorage),
      // Only persist the user object and token, not derived state
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      // Rehydrate isAuthenticated from persisted user
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = state.user !== null && state.token !== null
        }
      },
    }
  )
)

// Selector hooks
export const useCurrentUser = () => useAuthStore((s) => s.user)
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated)
export const useUserRole = () => useAuthStore((s) => s.user?.role ?? null)