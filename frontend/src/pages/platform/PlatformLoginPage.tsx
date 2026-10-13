import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { platformPost } from '@/lib/platformHttp'
import { usePlatformAuthStore } from '@/stores/platformAuth.store'
import { type iPlatformLoginResult } from '@/types'
import { T } from '@/lib/theme'

interface LoginValues {
  email: string
  password: string
}

export function PlatformLoginPage() {
  const navigate = useNavigate()
  const setAuth = usePlatformAuthStore((state) => state.setAuth)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginValues>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const mutation = useMutation<
    iPlatformLoginResult,
    Error,
    LoginValues
  >({
    mutationFn: (credentials) =>
      platformPost<iPlatformLoginResult>(
        '/platform/auth/login',
        credentials,
      ),
    onSuccess: (result) => {
      setAuth(result)
      void navigate('/platform/businesses', { replace: true })
    },
    onError: (error) => {
      setError('root', { message: error.message })
    },
  })

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: T.teal,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '40px 36px',
          borderRadius: 16,
          background: T.white,
          boxShadow: '0 20px 60px rgba(0,0,0,0.16)',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            color: T.teal,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          OMNI
        </p>

        <h1
          style={{
            margin: '0 0 8px',
            color: T.teal,
            fontSize: 30,
          }}
        >
          Platform Console
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            color: '#6B7280',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Sign in with your platform administrator account.
          Tenant accounts cannot access this console.
        </p>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          {errors.root && (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${T.rust}55`,
                background: `${T.rust}0d`,
                color: T.rust,
                fontSize: 13,
              }}
            >
              {errors.root.message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="platform-email" style={{ fontSize: 13, fontWeight: 600 }}>
              Email address
            </label>
            <input
              id="platform-email"
              type="email"
              autoComplete="username"
              placeholder="admin@example.com"
              disabled={mutation.isPending}
              aria-invalid={Boolean(errors.email)}
              {...register('email', {
                required: 'Email is required.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address.',
                },
              })}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                border: '1px solid #D8D0C4',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
            {errors.email && (
              <span role="alert" style={{ color: T.rust, fontSize: 12 }}>
                {errors.email.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="platform-password" style={{ fontSize: 13, fontWeight: 600 }}>
              Password
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="platform-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                disabled={mutation.isPending}
                aria-invalid={Boolean(errors.password)}
                {...register('password', {
                  required: 'Password is required.',
                })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px 14px',
                  border: '1px solid #D8D0C4',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={mutation.isPending}
                style={{
                  padding: '0 10px',
                  border: '1px solid #D8D0C4',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && (
              <span role="alert" style={{ color: T.rust, fontSize: 12 }}>
                {errors.password.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              marginTop: 8,
              padding: '13px 16px',
              border: 'none',
              borderRadius: 8,
              background: T.teal,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              cursor: mutation.isPending ? 'wait' : 'pointer',
              opacity: mutation.isPending ? 0.7 : 1,
            }}
          >
            {mutation.isPending ? 'Signing in…' : 'Sign in to platform'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default PlatformLoginPage
