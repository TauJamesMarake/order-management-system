
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type iPlatformLoginResult } from '@/types'

export const PLATFORM_TOKEN_KEY = 'omni_platform_access_token'

interface iPlatformAuthState {
  admin: iPlatformLoginResult['admin'] | null
  token: string | null
  isAuthenticated: boolean

  // Called after a successful platform login
  setAuth: (result: iPlatformLoginResult) => void

  // Called on logout or a platform API 401
  clearAuth: () => void

  // Alias for clearAuth
  logout: () => void
}

export const usePlatformAuthStore = create<iPlatformAuthState>()(
  persist(
    (set) => ({
      admin: null,
      token: null,
      isAuthenticated: false,

      setAuth: (result) => {
        sessionStorage.setItem(PLATFORM_TOKEN_KEY, result.token)

        set({
          admin: result.admin,
          token: result.token,
          isAuthenticated: true,
        })
      },

      clearAuth: () => {
        sessionStorage.removeItem(PLATFORM_TOKEN_KEY)

        set({
          admin: null,
          token: null,
          isAuthenticated: false,
        })
      },

      logout: () => {
        sessionStorage.removeItem(PLATFORM_TOKEN_KEY)

        set({
          admin: null,
          token: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'cloudmare_platform_auth',
      storage: createJSONStorage(() => sessionStorage),

      partialize: (state) => ({
        admin: state.admin,
        token: state.token,
      }),

      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated =
            state.admin !== null && state.token !== null

          if (state.token) {
            sessionStorage.setItem(PLATFORM_TOKEN_KEY, state.token)
          } else {
            sessionStorage.removeItem(PLATFORM_TOKEN_KEY)
          }
        }
      },
    },
  ),
)

// Selector hooks
export const usePlatformAdmin = () =>
  usePlatformAuthStore((state) => state.admin)

export const usePlatformIsAuthenticated = () =>
  usePlatformAuthStore((state) => state.isAuthenticated)
