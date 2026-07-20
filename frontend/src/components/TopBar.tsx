import { useAuthStore } from '@/stores/auth.store'
import { useMemo } from 'react'
import { T } from '@/components/ColorPalette'
import { useNavigate } from 'react-router-dom'

type RoleCfg = { bg: string; text: string; label: string }
const ROLE_CFG: Record<string, RoleCfg> = {
  admin: { bg: '#FEF0E8', text: T.rust, label: 'Administrator' },
  clerk: { bg: '#E0F0F0', text: T.deepTeal, label: 'Clerk' },
  viewer: { bg: T.panelBg, text: T.inkSecondary, label: 'Viewer' },
}

export function SearchIcon({ color }: { color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function BellIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function AlertIcon({ color = T.rust }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function TopBar({
  title,
  searchValue,
  onSearchChange,
}: {
  title: string
  searchValue: string
  onSearchChange: (v: string) => void
}) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const roleStyle = useMemo(() => {
    if (!user) return ROLE_CFG.viewer
    return ROLE_CFG[user.role] ?? ROLE_CFG.viewer
  }, [user])

  const initials = useMemo(() => {
    if (!user?.full_name) return '??'
    return user.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [user?.full_name])

  if (!user) return null

  return (
    <header
      style={{
        height: 85,
        backgroundColor: T.white,
        padding: '0 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderBottom: `1px solid ${T.charcoal}`,
        borderLeft: `1px solid ${T.charcoal}100`,
      }}
    >
      <div>
        {title.toLowerCase() === 'dashboard' ? (
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
              Dashboard
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ) : title.toLowerCase() === 'orders' ? (
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
              Orders
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
              Operational control panel
            </p>
          </div>
        ) : title.toLowerCase() === 'reports' ? (
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
                  Reports
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
                  {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
              : title.toLowerCase() === 'notifications' ? (
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
                    Notifications
                  </h1>
                  <p style={{ margin: 0, fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
                    Alerts, reminders & activity feed
                  </p>
                </div>
              )
              : (
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
                    {title}
                  </h1>
                </div>
              )
        }
      </div>

      <div style={{ position: 'relative', width: '38%', maxWidth: 460 }}>
        <span
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
          }}
        >
          <SearchIcon color={T.inkGhost} />
        </span>
        <input
          type="text"
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px 12px 46px',
            borderRadius: 30,
            border: `1px solid ${T.mutedCream}`,
            backgroundColor: T.panelBg,
            fontSize: 13,
            outline: 'none',
            color: T.inkPrimary,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          onClick={() => navigate('/notifications')}
          title="Notifications"
          style={{ position: 'relative', cursor: 'pointer', padding: 4 }}
        >
          <BellIcon color={title.toLowerCase() === 'notifications' ? T.deepTeal : T.inkSecondary} />
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: T.orange,
            }}
          />
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: T.mutedCream }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.inkPrimary, lineHeight: 1.2 }}>
              {user.full_name}
            </p>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 4,
                marginTop: 2,
                backgroundColor: roleStyle.bg,
                color: roleStyle.text,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {roleStyle.label}
            </span>
          </div>

          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${T.deepTeal}, ${T.charcoal})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: T.white, fontSize: 14, fontWeight: 700 }}>{initials}</span>
          </div>
        </div>
      </div>
    </header>
  )
}