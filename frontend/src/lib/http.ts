import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { type iApiSuccess } from '@/types'

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

// Requesting interceptor
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: unwrap + handle 401
http.interceptors.response.use(
  (response: AxiosResponse<iApiSuccess<unknown>>) => {
    if (response.config.responseType === 'blob') {
      return response as never
    }
    return response.data.data as never
  },
  (error) => {
    const status = error.response?.status

    const requestUrl = error.config?.url
    const isLoginRequest = typeof requestUrl === 'string' && requestUrl.includes('/auth/login')

    if (status === 401) {
      sessionStorage.removeItem(TOKEN_KEY)

      if (!isLoginRequest) {
        window.location.href = '/login'
      }
    }

    const errorBlob = error.response?.data
    if (errorBlob instanceof Blob && errorBlob.type.includes('json')) {
      return errorBlob.text().then((text: string) => {
        let message = error.message ?? 'An unexpected error occurred.'
        try {
          const parsed = JSON.parse(text)
          message = parsed.error ?? message
        } catch {
          // fall back to the generic catch message.
        }
        return Promise.reject(new Error(message))
      })
    }

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

// File downloads (exports, reports)
export async function downloadFile(
  url: string,
  fallbackFilename: string,
  config?: AxiosRequestConfig
): Promise<{ blob: Blob; filename: string }> {
  const response = await http.get<Blob, AxiosResponse<Blob>>(url, {
    ...config,
    responseType: 'blob',
  })

  const disposition = response.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)

  return {
    blob: response.data,
    filename: match?.[1] ?? fallbackFilename,
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}