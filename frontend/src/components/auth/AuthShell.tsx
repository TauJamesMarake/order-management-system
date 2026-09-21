import type { ReactNode } from 'react'
import { T } from '@/lib/theme'

// LEFT: Brand panel
function BrandPanel() {
    return (
        <div style={{
            width: '55%',
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
                    <circle cx="110" cy="96" r="6" fill="#FFFFFF" opacity="0.95" />
                    <circle cx="110" cy="96" r="12" fill="rgba(255,255,255,0.2)" />
                </svg>

                <p style={{
                    margin: '16px 0 0',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: 18,
                    fontWeight: 500,
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

interface iAuthShellProps {
    title: string
    /** Use a smaller heading for longer titles such as "Forgot password". */
    compactTitle?: boolean
    children: ReactNode
}

/** Two-panel layout shared by every unauthenticated page. */
export function AuthShell({ title, compactTitle = false, children }: iAuthShellProps) {
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

            <div style={{
                minHeight: '100vh',
                display: 'flex',
                fontFamily: 'Lato, system-ui, sans-serif',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: T.teal,
            }}>
                <div style={{
                    display: 'flex',
                    width: '100%',
                    minHeight: '100vh',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.4s ease-out forwards',
                }}>
                    <BrandPanel />

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
                        <h1 style={{
                            margin: 0,
                            marginBottom: 32,
                            paddingBottom: 12,
                            alignSelf: 'flex-start',
                            fontSize: compactTitle ? 36 : 48,
                            fontFamily: 'Lato, sans-serif',
                            fontWeight: 700,
                            color: T.teal,
                            borderBottom: `2.5px solid ${T.teal}`,
                            letterSpacing: '-0.01em',
                        }}>
                            {title}
                        </h1>

                        {children}
                    </div>
                </div>
            </div>
        </>
    )
}