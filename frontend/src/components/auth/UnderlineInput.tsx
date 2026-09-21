import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { T } from '@/lib/theme'

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

interface iUnderlineInputProps {
    id: string
    label: string
    type?: string
    placeholder?: string
    autoComplete?: string
    error?: string
    disabled?: boolean
    registration: UseFormRegisterReturn
    showToggle?: boolean
    toggleVisible?: boolean
    onToggle?: () => void
}

export function UnderlineInput({
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
                    {...registration}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => {
                        setFocused(false)
                        // Keep react-hook-form's blur handler (validation mode: onBlur).
                        void registration.onBlur(e)
                    }}
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
                    }}
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