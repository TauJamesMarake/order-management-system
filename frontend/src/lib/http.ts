import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { type iApiSuccess } from '@/types'

// Token key must stay in sync with auth.store.ts
const TOKEN_KEY = 'oms_access_token'

// Create the shared instance
export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor — inject Bearer token
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — unwrap + handle 401
http.interceptors.response.use(
  // On success: the backend always wraps in { success, data }.
  // We unwrap so every service function receives T directly.
  (response: AxiosResponse<iApiSuccess<unknown>>) => {
    return response.data.data as never
  },
  (error) => {
    const status = error.response?.status

    // Avoid hard navigation/reload for login failures.
    // Wrong credentials should be handled by the LoginPage form UI.
    const requestUrl = error.config?.url
    const isLoginRequest = typeof requestUrl === 'string' && requestUrl.includes('/auth/login')

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY)

      if (!isLoginRequest) {
        window.location.href = '/login'
      }
    }

    // Re-shape the error so catch handlers get a plain message
    const message: string =
      error.response?.data?.error ?? error.message ?? 'An unexpected error occurred.'
    return Promise.reject(new Error(message))
  }
)

// Typed convenience wrappers
// These preserve the generic T without the caller needing to
// manually assert the unwrapped type every time.

export async function get<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  return http.get<T, T>(url, config)
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  return http.post<T, T>(url, data, config)
}

export async function patch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  return http.patch<T, T>(url, data, config)
}

export async function del<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  return http.delete<T, T>(url, config)
}