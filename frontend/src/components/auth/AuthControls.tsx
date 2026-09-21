import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { T } from '@/lib/theme'

export function AuthBanner({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
    const color = tone === 'error' ? T.rust : T.deepTeal

    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 14px',
                backgroundColor: `${color}0d`,
                border: `1px solid ${color}33`,
                borderRadius: 8,
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true">
                {tone === 'error' ? (
                    <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </>
                ) : (
                    <>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </>
                )}
            </svg>
            <p style={{ margin: 0, fontSize: 12, fontFamily: 'Lato, sans-serif', color, lineHeight: 1.5 }}>
                {children}
            </p>
        </div>
    )
}

interface iAuthButtonProps {
    loading?: boolean
    loadingLabel?: string
    disabled?: boolean
    variant?: 'primary' | 'secondary'
    type?: 'submit' | 'button'
    onClick?: () => void
    children: ReactNode
}

export function AuthButton({
    loading = false, loadingLabel, disabled = false,
    variant = 'primary', type = 'submit', onClick, children,
}: iAuthButtonProps) {
    const [hover, setHover] = useState(false)
    const inactive = loading || disabled
    const primary = variant === 'primary'

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={inactive}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                width: '100%',
                height: 46,
                borderRadius: 10,
                border: primary ? 'none' : `1.5px solid ${T.teal}`,
                backgroundColor: primary
                    ? (hover && !inactive ? T.deepTeal : T.teal)
                    : (hover && !inactive ? `${T.teal}14` : 'transparent'),
                color: primary ? '#fff' : T.deepTeal,
                fontSize: 14,
                fontFamily: 'Lato, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: inactive ? 'not-allowed' : 'pointer',
                opacity: inactive ? 0.65 : 1,
                transition: 'background-color 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
        >
            {loading ? (
                <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {loadingLabel ?? children}
                </>
            ) : children}
        </button>
    )
}

export function AuthTextLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} style={{
            fontSize: 12,
            fontFamily: 'Lato, sans-serif',
            color: T.charcoal,
            textDecoration: 'none',
            borderBottom: `1px solid ${T.charcoal}44`,
            paddingBottom: 1,
        }}>
            {children}
        </Link>
    )
}