import { useAuthStore } from '@/stores/auth.store'
import { T } from '@/components/ColorPalette'
import { useNavigate } from 'react-router-dom'

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

  if (!user) return null

  let heading = ''
  let subtitle = ''

  switch (title.toLowerCase()) {
    case 'dashboard':
      heading = 'Dashboard'
      subtitle = `Welcome back, ${user.full_name}.`
      break
    case 'orders':
      heading = 'Orders'
      subtitle = 'Operational control panel'
      break
    case 'reports':
      heading = 'Reports'
      subtitle = 'Analytics, performance metrics & ledger insights'
      break
    case 'users':
      heading = 'Users'
      subtitle = 'Access control, team members & role management'
      break
    case 'customers':
      heading = 'Customers'
      subtitle = 'Viewer accounts & associated orders'
      break
    case 'notifications':
      heading = 'Notifications'
      subtitle = 'Alerts, reminders & activity feed'
      break
    default:
      heading = title
      break
  }

  return (
    <header
      style={{
        height: 85,
        backgroundColor: T.white,
        padding: '0 32px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 24,
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderLeft: `1px solid ${T.charcoal}100`,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.inkPrimary, textTransform: 'capitalize' }}>
          {heading}
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ position: 'relative', width: 380, maxWidth: 380 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24 }}>
        {(user?.role === 'admin' || user?.role === 'clerk') && (
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
        )}

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.inkPrimary, lineHeight: 1.2 }}>
            {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: T.inkGhost, fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </header>
  )
}

