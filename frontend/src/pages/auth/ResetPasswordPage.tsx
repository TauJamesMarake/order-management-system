import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { post } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import { T } from '@/lib/theme'
import { AuthShell } from '@/components/auth/AuthShell'
import { UnderlineInput } from '@/components/auth/UnderlineInput'
import { AuthBanner, AuthButton, AuthTextLink } from '@/components/auth/AuthControls'

// Mirrors the backend NewPasswordSchema (8–72 chars).
const resetSchema = z
  .object({
    password: z.string().min(8, 'Min 8 characters.').max(72, 'Max 72 characters.'),
    confirm: z.string().min(1, 'Required.'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  })

type ResetValues = z.infer<typeof resetSchema>

type RecoveryLink = { status: 'valid'; token: string } | { status: 'invalid' }

/**
 * Supabase redirects here with the session in the URL *fragment*:
 *   /reset-password#access_token=…&refresh_token=…&type=recovery
 * or, when the link is expired/used:
 *   /reset-password#error=access_denied&error_code=otp_expired&…
 * Fragments are never sent to a server, so the token stays in the browser
 * until we POST it to our own API.
 */
function readRecoveryLink(): RecoveryLink {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('access_token')

  if (params.get('error') || params.get('error_code')) return { status: 'invalid' }
  if (!token || params.get('type') !== 'recovery') return { status: 'invalid' }

  return { status: 'valid', token }
}

interface iResetFormProps {
  token: string
}

function ResetForm({ token }: iResetFormProps) {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [showPwd, setShowPwd] = useState(false)

  const { register, handleSubmit, formState: { errors }, setError } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const mutation = useMutation<null, Error, ResetValues>({
    mutationFn: ({ password }) =>
      post<null>('/auth/update-password', { access_token: token, password }),
    onSuccess: () => {
      // The backend revokes all sessions; drop any stale local one too.
      clearAuth()
      navigate('/login', { replace: true, state: { passwordReset: true } })
    },
    onError: (err) => setError('root', { message: err.message }),
  })

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      <p style={{ margin: 0, fontSize: 13, fontFamily: 'Lato, sans-serif', color: T.inkSecondary, lineHeight: 1.6 }}>
        Choose a new password. You'll be signed out everywhere and asked to sign in again.
      </p>

      {errors.root && <AuthBanner tone="error">{errors.root.message}</AuthBanner>}

      <UnderlineInput
        id="reset-password"
        label="New Password"
        type={showPwd ? 'text' : 'password'}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        error={errors.password?.message}
        disabled={mutation.isPending}
        registration={register('password')}
        showToggle
        toggleVisible={showPwd}
        onToggle={() => setShowPwd((v) => !v)}
      />

      <UnderlineInput
        id="reset-confirm"
        label="Confirm Password"
        type={showPwd ? 'text' : 'password'}
        placeholder="Repeat the password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        disabled={mutation.isPending}
        registration={register('confirm')}
      />

      <AuthButton loading={mutation.isPending} loadingLabel="Saving…">Save new password</AuthButton>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <AuthTextLink to="/forgot-password">Request a new link</AuthTextLink>
        <AuthTextLink to="/login">Back to sign in</AuthTextLink>
      </div>
    </form>
  )
}

export function ResetPasswordPage() {
  // Lazy initialiser: read the fragment once, before we strip it.
  const [link] = useState<RecoveryLink>(readRecoveryLink)

  // Remove the token from the address bar and browser history.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  if (link.status === 'invalid') {
    return (
      <AuthShell title="Link expired" compactTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <AuthBanner tone="error">
            This reset link is invalid, has already been used, or has expired.
          </AuthBanner>

          <p style={{ margin: 0, fontSize: 13, fontFamily: 'Lato, sans-serif', color: T.inkSecondary, lineHeight: 1.6 }}>
            Reset links work once and expire after an hour. Request a new one to continue.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <AuthTextLink to="/forgot-password">Request a new link</AuthTextLink>
            <AuthTextLink to="/login">Back to sign in</AuthTextLink>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="New password" compactTitle>
      <ResetForm token={link.token} />
    </AuthShell>
  )
}

export default ResetPasswordPage