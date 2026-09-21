import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { post } from '@/lib/http'
import { T } from '@/lib/theme'
import { AuthShell } from '@/components/auth/AuthShell'
import { UnderlineInput } from '@/components/auth/UnderlineInput'
import { AuthBanner, AuthButton, AuthTextLink } from '@/components/auth/AuthControls'

const forgotSchema = z.object({
    email: z.string().trim().min(1, 'Required.').email('Enter a valid email.'),
})

type ForgotValues = z.infer<typeof forgotSchema>

const RESEND_COOLDOWN_SECONDS = 60

export function ForgotPasswordPage() {
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [cooldown, setCooldown] = useState(0)

    const { register, handleSubmit, formState: { errors }, setError, clearErrors } = useForm<ForgotValues>({
        resolver: zodResolver(forgotSchema),
        mode: 'onBlur',
        reValidateMode: 'onChange',
    })

    useEffect(() => {
        if (cooldown <= 0) return
        const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => window.clearTimeout(id)
    }, [cooldown])

    const mutation = useMutation<null, Error, ForgotValues>({
        mutationFn: ({ email }) => post<null>('/auth/reset-password', { email }),
        onSuccess: (_data, { email }) => {
            clearErrors('root')
            setSentTo(email)
            setCooldown(RESEND_COOLDOWN_SECONDS)
        },
        onError: (err) => setError('root', { message: err.message }),
    })

    if (sentTo) {
        return (
            <AuthShell title="Check your email" compactTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <AuthBanner tone="success">
                        If an account exists for {sentTo}, a reset link has been sent. The link expires after one minute.
                    </AuthBanner>

                    <p style={{ margin: 0, fontSize: 13, fontFamily: 'Lato, sans-serif', color: T.inkSecondary, lineHeight: 1.6 }}>
                        Nothing arrived? Check your spam folder, or confirm the address is the one on your account.
                    </p>

                    {errors.root && <AuthBanner tone="error">{errors.root.message}</AuthBanner>}

                    <AuthButton
                        type="button"
                        variant="secondary"
                        loading={mutation.isPending}
                        loadingLabel="Sending…"
                        disabled={cooldown > 0}
                        onClick={() => mutation.mutate({ email: sentTo })}
                    >
                        {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again'}
                    </AuthButton>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button
                            type="button"
                            onClick={() => setSentTo(null)}
                            style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                fontSize: 12, fontFamily: 'Lato, sans-serif', color: T.charcoal,
                                borderBottom: `1px solid ${T.charcoal}44`,
                            }}
                        >
                            Use a different email
                        </button>
                        <AuthTextLink to="/login">Back to sign in</AuthTextLink>
                    </div>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Forgot password" compactTitle>
            <form
                onSubmit={handleSubmit((v) => mutation.mutate(v))}
                noValidate
                style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
            >
                <p style={{ margin: 0, fontSize: 13, fontFamily: 'Lato, sans-serif', color: T.inkSecondary, lineHeight: 1.6 }}>
                    Enter the email address on your account to choose a new password.
                </p>

                {errors.root && <AuthBanner tone="error">{errors.root.message}</AuthBanner>}

                <UnderlineInput
                    id="forgot-email"
                    label="Email Address"
                    type="email"
                    placeholder="your@company.co.za"
                    autoComplete="email"
                    error={errors.email?.message}
                    disabled={mutation.isPending}
                    registration={register('email')}
                />

                <AuthButton loading={mutation.isPending} loadingLabel="Sending…">Send reset link</AuthButton>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <AuthTextLink to="/login">Back to sign in</AuthTextLink>
                </div>
            </form>
        </AuthShell>
    )
}

export default ForgotPasswordPage