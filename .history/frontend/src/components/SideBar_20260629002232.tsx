import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { T } from '@/components/ColorPalette'
import { Settings } from '@/components/Settings' // Import the settings component

// Icons are duplicated from Dashboard/Orders to keep this component self-contained.
function DashIcon({ color }: { color: string }) {
    return (
        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke={color} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\">
            <rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\" />
            <rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1\" />
            <rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1\" />
            <rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1\" />
        </svg>
    )
}
function OrderIcon({ color }: { color: string }) {
    return (
        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke={color} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\">
            <path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\" />
            <polyline points=\"14 2 14 8 20 8\" />
            <line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\" />
            <line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\" />
            <polyline points=\"10 9 9 9 8 9\" />
        </svg>
    )
}
function ReportIcon({ color }: { color: string }) {
    return (
        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke={color} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\">
            <line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\" />
            <line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\" />
            <line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\" />
        </svg>
    )
}
function SettingsIcon({ color }: { color: string }) {
    return (
        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke={color} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\">
            <circle cx=\"12\" cy=\"12\" r=\"3\" />
            <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\" />
        </svg>
    )
}
function LogoutIcon({ color }: { color: string }) {
    return (
        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke={color} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\">
            <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />
            <polyline points=\"16 17 21 12 16 7\" />
            <line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\" />
        </svg>
    )
}

export function SideBar() {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.logout)
    const currentPath = window.location.pathname
    const [isSettingsOpen, setIsSettingsOpen] = useState(false) // Track menu state

    return (
        <aside
            style={{
                width: 260,
                backgroundColor: T.deepTeal,
                color: T.white,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                boxSizing: 'border-box',
                flexShrink: 0,
            }}
        >
            {/* Header / Branding */}
            <div style={{ marginBottom: 48 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: T.cream }}>
                    Ntsoaki OMS
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Mineral Distribution Portal
                </p>
            </div>

            {/* Main Navigation Matrix */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 16,
                        backgroundColor: currentPath === '/dashboard' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: currentPath === '/dashboard' ? T.white : T.inkGhost,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (currentPath !== '/dashboard') e.currentTarget.style.color = T.white
                    }}
                    onMouseLeave={(e) => {
                        if (currentPath !== '/dashboard') e.currentTarget.style.color = T.inkGhost
                    }}
                >
                    <DashIcon color={currentPath === '/dashboard' ? T.teal : 'currentColor'} />
                    <span style={{ fontSize: 14, fontWeight: currentPath === '/dashboard' ? 600 : 500 }}>Dashboard</span>
                </button>

                <button
                    onClick={() => navigate('/orders')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 16,
                        backgroundColor: currentPath === '/orders' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: currentPath === '/orders' ? T.white : T.inkGhost,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (currentPath !== '/orders') e.currentTarget.style.color = T.white
                    }}
                    onMouseLeave={(e) => {
                        if (currentPath !== '/orders') e.currentTarget.style.color = T.inkGhost
                    }}
                >
                    <OrderIcon color={currentPath === '/orders' ? T.teal : 'currentColor'} />
                    <span style={{ fontSize: 14, fontWeight: currentPath === '/orders' ? 600 : 500 }}>Internal Orders</span>
                </button>

                <button
                    onClick={() => navigate('/reports')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 16,
                        backgroundColor: currentPath === '/reports' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: currentPath === '/reports' ? T.white : T.inkGhost,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (currentPath !== '/reports') e.currentTarget.style.color = T.white
                    }}
                    onMouseLeave={(e) => {
                        if (currentPath !== '/reports') e.currentTarget.style.color = T.inkGhost
                    }}
                >
                    <ReportIcon color={currentPath === '/reports' ? T.teal : 'currentColor'} />
                    <span style={{ fontSize: 14, fontWeight: currentPath === '/reports' ? 600 : 500 }}>Analytics & Reports</span>
                </button>
            </nav>

            {/* Footer Control Station */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
                <button
                    onClick={() => setIsSettingsOpen(true)} // Open Settings panel overlay on click
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 16,
                        backgroundColor: isSettingsOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: isSettingsOpen ? T.white : T.inkGhost,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                    onMouseLeave={(e) => {
                        if (!isSettingsOpen) e.currentTarget.style.color = T.inkGhost
                    }}
                >
                    <SettingsIcon color={isSettingsOpen ? T.teal : 'currentColor'} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Settings</span>
                </button>

                {/* Conditional insertion of the overlay component passing the close toggle hook */}
                {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}

                <button
                    onClick={() => {
                        clearAuth()
                        navigate('/login', { replace: true })
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 16,
                        backgroundColor: 'transparent',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: T.rust,
                        transition: 'all 0.2s',
                    }}
                >
                    <LogoutIcon color=\"currentColor\" />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Sign Out</span>
                </button>
            </div>
        </aside>
    )
}