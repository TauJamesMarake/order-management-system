import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router-dom'

import { T } from '@/components/ColorPalette'

interface iSettingsProps {
  /** Callback triggered to close overlay context */
  onClose: () => void
}

/**
 * @component Settings
 * @description Fixed configuration overlay modal that safely exposes multi-tenant scope fields,
 * active user profiles, and operational parameters based on authenticated context boundaries.
 */
export function Settings({ onClose }: iSettingsProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 74, /* Positioned cleanly relative to the sidebar button baseline */
        left: 24,
        zIndex: 9999,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Backdrop Dismissal Trigger Layer */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, cursor: 'default' }}
      />

      {/* Flyout Panel Box Content */}
      <div
        style={{
          width: 310,
          backgroundColor: T.white,
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(14,31,31,0.25)',
          border: `1px solid ${T.mutedCream}`,
          padding: 20,
          animation: 'slideUp 0.15s ease-out forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header Identity Meta Matrix */}
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>
            {user.full_name || 'System User'}
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: T.inkGhost, wordBreak: 'break-all' }}>
            {user.email}
          </p>
        </div>

        <hr style={{ margin: 0, border: 'none', borderBottom: `1px solid ${T.mutedCream}60` }} />

        {/* Tenant Bounded Scope Section */}
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tenant Bounding Isolation Environment
          </span>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: T.inkSecondary }}>Business Context ID:</span>
              <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace", fontSize: 11, fontWeight: 600, color: T.inkPrimary }}>
                {/* {user.business_id ? `${user.business_id.substring(0, 8)}...` : 'N/A'} */}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: T.inkSecondary }}>Assigned Profile Role:</span>
              <span
                style={{
                  fontWeight: 700,
                  color: user.role === 'admin' ? T.teal : T.orange,
                  textTransform: 'uppercase',
                  fontSize: 11
                }}
              >
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <hr style={{ margin: 0, border: 'none', borderBottom: `1px solid ${T.mutedCream}60` }} />

        {/* Security Parameters Metadata */}
        <div style={{ backgroundColor: T.mutedCream + '40', padding: '10px 12px', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSecondary }}>
              Data Isolation Rule Active
            </span>
          </div>
          <p style={{ margin: '4px 0 0 14px', fontSize: 11, color: T.inkGhost, lineHeight: 1.4 }}>
            All transaction sessions are dynamically sealed.
          </p>
        </div>

        {/* Logout Action Gateway Trigger */}
        <button
          onClick={() => {
            clearAuth()
            navigate('/login', { replace: true })
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: T.charcoal,
            border: `1px solid ${T.rust}40`,
            color: T.white,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = T.teal
            e.currentTarget.style.color = T.white
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = T.charcoal
            e.currentTarget.style.color = T.white
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Embedded CSS Injection Keyframes for entry movement */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Settings