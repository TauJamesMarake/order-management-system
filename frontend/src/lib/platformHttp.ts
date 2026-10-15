import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios'
import { type iApiSuccess } from '@/types'
import { PLATFORM_TOKEN_KEY, usePlatformAuthStore } from '@/stores/platformAuth.store'

const isLocalFrontend = ['localhost', '127.0.0.1'].includes(
    window.location.hostname,
)
const configuredApiUrl = process.env.VITE_API_URL

const apiBaseUrl =
    configuredApiUrl &&
        (!isLocalFrontend || /^https?:\/\//i.test(configuredApiUrl))
        ? configuredApiUrl
        : isLocalFrontend
            ? 'http://localhost:5000/api'
            : configuredApiUrl ?? '/api'

// Dedicated HTTP instance for platform administration.
export const platformHttp: AxiosInstance = axios.create({
    baseURL: apiBaseUrl,
    timeout: 15_000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
})

// Attach only the platform admin token.
platformHttp.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = sessionStorage.getItem(PLATFORM_TOKEN_KEY)

        if (token) {
            config.headers.set('Authorization', `Bearer ${token}`)
        }

        return config
    },
    (error) => Promise.reject(error),
)

// Unwrap successful responses and handle expired platform sessions.
platformHttp.interceptors.response.use(
    (response: AxiosResponse<iApiSuccess<unknown>>) => {
        if (response.config.responseType === 'blob') {
            return response as never
        }

        return response.data.data as never
    },
    (error) => {
        const status = error.response?.status

        if (status === 405) {
            return Promise.reject(
                new Error(
                    'This action is unavailable right now. Refresh the page and try again.',
                ),
            )
        }

        const requestUrl = error.config?.url
        const isPlatformLoginRequest =
            typeof requestUrl === 'string' &&
            requestUrl.includes('/platform/auth/login')

        if (status === 401) {
            usePlatformAuthStore.getState().clearAuth()

            if (!isPlatformLoginRequest) {
                window.location.href = '/platform/login'
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
                    // Keep the original message if the response cannot be parsed.
                }

                return Promise.reject(new Error(message))
            })
        }

        const message: string =
            error.response?.data?.error ??
            error.message ??
            'An unexpected error occurred.'

        return Promise.reject(new Error(message))
    },
)

// Typed convenience wrappers.
export async function platformGet<T>(
    url: string,
    config?: AxiosRequestConfig,
): Promise<T> {
    return platformHttp.get<T, T>(url, config)
}

export async function platformPost<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
): Promise<T> {
    return platformHttp.post<T, T>(url, data, config)
}

export async function platformPatch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
): Promise<T> {
    return platformHttp.patch<T, T>(url, data, config)
}

export async function platformDel<T>(
    url: string,
    config?: AxiosRequestConfig,
): Promise<T> {
    return platformHttp.delete<T, T>(url, config)
}
