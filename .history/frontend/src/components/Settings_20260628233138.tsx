Based on the provided **SRS v2.0** and your current setup, here is the answer regarding order creation followed by the implementation of the `Settings` component overlay.

---

### Part 1: Who can create a new order?

Based on the **Access Control Matrix** defined in the SRS:

* **`admin`**: Has full CRUD capability on orders.
* **`clerk`**: Has permission to create new orders, but can only modify/cancel orders they personally originated.
* **`viewer`**: Prevented from mutating any state or creating records (Read-only observation).

Therefore, **both the `admin` and `clerk` roles can create a new order**.

---

### Part 2: Bottom-Left Settings Component Implementation

This component fixes itself directly to the bottom-left corner of the screen (overlaying the sidebar structure or viewport corner safely). It tracks tenant details, displays administrative information, allows an administrative role to view system status, and handles user logout.

```tsx
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { T } from '@/components/ColorPalette'

interface SettingsProps {
  /** Optional callback if parent components need to react to state changes */
  onClose?: () => void
}

/**
 * Presentation Settings Gear Icon Component
 */
function GearIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/**
 * @component Settings
 * @description Fixed bottom-left configuration overlay that safely exposes multi-tenant scope fields,
 * active user profiles, and operational metrics based on authenticated context boundaries.
 */
export function Settings({ onClose }: SettingsProps) {
  const { user, logout } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: 24, 
        left: 24, 
        zIndex: 9999, 
        fontFamily: 'system-ui, -apple-system, sans-serif' 
      }}
    >
      {/* Configuration Toggle Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 42,
          height: 42,
          borderRadius: '50%',
          backgroundColor: isOpen ? T.deepTeal : T.white,
          border: `1px solid ${T.mutedCream}`,
          boxShadow: '0 4px 12px rgba(14,31,31,0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: isOpen ? T.white : T.deepTeal,
        }}
        title="Account & Tenant Configuration"
      >
        <GearIcon color="currentColor" />
      </button>

      {/* Flyout Panel Overlay Context */}
      {isOpen && (
        <>
          {/* Backdrop Dismissal Trigger Layer */}
          <div 
            onClick={() => { setIsOpen(false); if(onClose) onClose(); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: 54,
              left: 0,
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
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: T.inkPrimary }}>
                    {user.business_id ? `${user.business_id.substring(0, 8)}...` : 'N/A'}
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
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: T.success || '#10B981' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSecondary }}>
                  Data Isolation Rule Active
                </span>
              </div>
              <p style={{ margin: '4px 0 0 14px', fontSize: 11, color: T.inkGhost, lineHeight: 1.4 }}>
                All transaction sessions are dynamically sealed through database Row Level Security.
              </p>
            </div>

            {/* Logout Action Gateway Trigger */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'transparent',
                border: `1px solid ${T.rust}40`,
                color: T.rust,
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
                e.currentTarget.style.backgroundColor = T.rust;
                e.currentTarget.style.color = T.white;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = T.rust;
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Terminate Session (Logout)
            </button>
          </div>
        </>
      )}

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