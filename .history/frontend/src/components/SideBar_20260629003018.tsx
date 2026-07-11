import React, { useState} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { T } from '@/components/ColorPalette'
import { Settings } from '@/components/Settings'

// Icons are duplicated from Dashboard/Orders to keep this component self-contained.
function DashIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    )
}
function OrderIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    )
}
function ReportIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    )
}
function UserIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
function SettingsIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}
function LogoutIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    )
}


type NavId = 'dashboard' | 'orders' | 'reports' | 'users'

const NAV_ITEMS: Array<{ id: NavId; label: string; icon: React.FC<{ color: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: DashIcon },
    { id: 'orders', label: 'Orders', icon: OrderIcon },
    { id: 'reports', label: 'Reports', icon: ReportIcon },
    { id: 'users', label: 'Users', icon: UserIcon },
]

export function SideBar({ activePage, onSettingsClick }: { activePage: string; onSettingsClick?: () => void }) {
    const navigate = useNavigate()
    const { clearAuth } = useAuthStore()
    // Sidebar no longer owns settings overlay state; parent controls it.
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)



    return (
        <aside
            style={{
                width: 250,
                backgroundColor: T.darkBg,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                height: '100vh',
                borderTopRightRadius: 28,
                borderBottomRightRadius: 28,
                overflow: 'hidden',
                boxShadow: '4px 0 24px rgba(14,31,31,0.15)',
            }}
        >
            <div>
                <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: T.teal,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span style={{ color: T.white, fontWeight: 800, fontSize: 20 }}>M</span>
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.white, letterSpacing: '0.02em' }}>M A R E</p>
                        <p style={{ margin: 0, fontSize: 10, color: T.teal, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Order Management
                        </p>
                    </div>
                </div>

                <nav style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                        const active = activePage === id
                        return (
                            <button
                                key={id}
                                onClick={() => navigate(`/${id}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    padding: '12px 18px',
                                    borderRadius: 16,
                                    backgroundColor: active ? T.teal : 'transparent',
                                    border: 'none',
                                    width: '100%',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <Icon color={active ? T.white : T.inkGhost} />
                                <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? T.white : T.inkGhost }}>{label}</span>
                            </button>
                        )
                    })}
                </nav>
            </div>

            <div style={{ padding: '20px 16px', borderTop: `1px solid ${T.charcoal}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    <LogoutIcon color="currentColor" />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Sign Out</span>
                </button>
            </div>
        </aside>
    )
}

