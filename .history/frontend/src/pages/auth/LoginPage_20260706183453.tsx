import { useState, type CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { post } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import { type LoginResult, type iAuthUser } from '@/types'
import { T } from '@/lib/theme'

// Validation schemas
const signInSchema = z.object({
  email: z.string().min(1, 'Required.').email('Enter a valid email.'),
  password: z.string().min(1, 'Required.').min(6, 'Min 6 characters.'),
})

type SignInValues = z.infer<typeof signInSchema>

// Eye toggle icon
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Underline input interface
interface iUnderlineInputProps {
  id: string
  label: string
  type?: string
  placeholder?: string
  autoComplete?: string
  error?: string
  disabled?: boolean
  registration: Record<string, unknown>
  showToggle?: boolean
  toggleVisible?: boolean
  onToggle?: () => void
}

function UnderlineInput({
  id, label, type = 'text', placeholder, autoComplete,
  error, disabled, registration,
  showToggle, toggleVisible, onToggle,
}: iUnderlineInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 12,
          fontFamily: '"DM Mono", monospace',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: focused ? T.deepTeal : T.teal,
          transition: 'color 0.15s',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: 38,
            padding: showToggle ? '0 36px 0 0' : '0',
            fontSize: 14,
            fontFamily: 'Lato, system-ui, sans-serif',
            color: T.inkPrimary,
            background: 'transparent',
            border: 'none',
            borderBottom: `1.5px solid ${error ? T.rust : focused ? T.deepTeal : '#D8D0C4'}`,
            borderRadius: 0,
            outline: 'none',
            transition: 'border-color 0.15s',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.55 : 1,
            boxSizing: 'border-box',
          } as CSSProperties}
          {...(registration as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={toggleVisible ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: T.inkGhost, display: 'flex', alignItems: 'center',
            }}
          >
            <EyeIcon visible={!!toggleVisible} />
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{ margin: 0, fontSize: 11, fontFamily: 'Lato, sans-serif', color: T.rust }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// LEFT: Brand panel 
function BrandPanel() {
  return (
    <div style={{
      width: '45%',
      flexShrink: 0,
      backgroundColor: T.teal,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '32px 36px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Topographic lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08, pointerEvents: 'none' }}
        viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i}
            d={`M-20,${i * 48} Q100,${i * 48 - 18 + i} 240,${i * 48 + 20} Q340,${i * 48 + 32} 420,${i * 48 + 8}`}
            fill="none" stroke="#F5DFBB" strokeWidth="1.5" />
        ))}
      </svg>

      {/* Decorative circle - bottom right */}
      <div style={{
        position: 'absolute',
        bottom: -80, right: -80,
        width: 280, height: 280,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -40, right: -40,
        width: 180, height: 180,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }} />

      {/* Centre area */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>

        {/* Abstract mineral/mining SVG illustration */}
        <svg width="220" height="220" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          {/* Central hexagon shape */}
          <polygon
            points="110,30 170,65 170,135 110,170 50,135 50,65"
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />
          <polygon
            points="110,52 150,74 150,118 110,140 70,118 70,74"
            fill="rgba(255,255,255,0.18)"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
          />
          <polygon
            points="110,74 130,85 130,107 110,118 90,107 90,85"
            fill="rgba(255,255,255,0.25)"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
          />

          {/* Centre glow dot */}
          <circle cx="110" cy="96" r="6" fill="#FFFFFF" opacity="0.95" />
          <circle cx="110" cy="96" r="12" fill="rgba(255,255,255,0.2)" />
        </svg>

        <p style={{
          margin: '16px 0 0',
          fontFamily: '"DM Mono", monospace',
          fontSize: 18,
          fontWeight: 600,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          Order Management System<br />
          <span style={{ color: T.cream, fontSize: 15, fontWeight: 400, fontFamily: 'Ramaraja, serif' }}>
            Manage With Precision.
          </span>
        </p>
      </div>

      {/* Copyright */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ margin: 0, fontFamily: '"DM Mono", monospace', fontSize: 10, color: 'rgba(239, 236, 230, 0.72)', letterSpacing: '0.04em' }}>
          © {new Date().getFullYear()} Mare (Pty) Ltd
        </p>
      </div>
    </div>
  )
}

// RIGHT: Sign In form
function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const setAuth = useAuthStore((s: { setAuth: (u: iAuthUser, t: string) => void }) => s.setAuth)
  const [showPwd, setShowPwd] = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  const { register, handleSubmit, formState: { errors }, setError } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const mutation = useMutation<LoginResult, Error, SignInValues>({
    mutationFn: (creds) => post<LoginResult>('/auth/login', creds),
    onSuccess: (result) => {
      setAuth(result.user, result.token)
      onSuccess()
    },
    onError: (err) => setError('root', { message: err.message }),
  })

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      {errors.root && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 14px',
          backgroundColor: `${T.rust}0d`,
          border: `1px solid ${T.rust}33`,
          borderRadius: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.rust}
            strokeWidth="2" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, fontFamily: 'Lato, sans-serif', color: T.rust }}>
            {errors.root.message}
          </p>
        </div>
      )}

      <UnderlineInput
        id="signin-email"
        label="Email Address"
        type="email"
        placeholder="you@mare.co.za"
        autoComplete="email"
        error={errors.email?.message}
        disabled={mutation.isPending}
        registration={register('email')}
      />

      <UnderlineInput
        id="signin-password"
        label="Password"
        type={showPwd ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        disabled={mutation.isPending}
        registration={register('password')}
        showToggle
        toggleVisible={showPwd}
        onToggle={() => setShowPwd((v: boolean) => !v)}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
        <Link to="/reset-password" style={{
          fontSize: 12,
          fontFamily: 'Lato, sans-serif',
          color: T.charcoal,
          textDecoration: 'none',
          borderBottom: `1px solid ${T.charcoal}44`,
          paddingBottom: 1,
        }}>
          Forgot password
        </Link>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          width: '100%',
          height: 46,
          marginTop: 4,
          borderRadius: 10,
          border: 'none',
          backgroundColor: btnHover && !mutation.isPending ? T.deepTeal : T.teal,
          color: '#fff',
          fontSize: 14,
          fontFamily: 'Lato, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.04em',
          cursor: mutation.isPending ? 'not-allowed' : 'pointer',
          opacity: mutation.isPending ? 0.65 : 1,
          transition: 'background-color 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {mutation.isPending ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Signing in…
          </>
        ) : 'Sign In'}
      </button>
    </form>
  )
}

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500;600&family=Lato:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #C4B9AC; font-size: 13px; }
        input::-webkit-input-placeholder { color: #C4B9AC; }
      `}</style>

      {/* Full-screen container */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: 'Lato, system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: T.teal
      }}>
        {/* Card */}
        <div style={{
          display: 'flex',
          width: '100%',
          minHeight: '100vh',
          overflow: 'hidden',
          animation: 'fadeIn 0.4s ease-out forwards',
        }}>

          {/* Left panel */}
          <BrandPanel />

          {/* Right panel */}
          <div style={{
            flex: 1,
            backgroundColor: T.white,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '44px 48px',
            borderRadius: '50px 0 0 0',
            overflow: 'auto',
          }}>

            {/* Sign In Heading */}
            <h1 style={{
              margin: 0,
              marginBottom: 32,
              paddingBottom: 12,
              // alignSelf: 'center',
              fontSize: 48,
              fontFamily: 'Lato, sans-serif',
              fontWeight: 700,
              color: T.teal,
              borderBottom: `2.5px solid ${T.teal}`,
              letterSpacing: '-0.01em',
            }}>
              Sign In
            </h1>

            <SignInForm onSuccess={() => void navigate('/dashboard', { replace: true })} />
          </div>
        </div>
      </div>
    </>
  )
}

export default LoginPage