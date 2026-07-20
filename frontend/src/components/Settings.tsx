import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router-dom'
import { patch } from '@/lib/http'
import type { iUser } from '@/types'

import { T } from '@/components/ColorPalette'

function EditIcon({ color }: { color: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}

interface iSettingsProps {
  /** Callback triggered to close overlay context */
  onClose: () => void
}

export function Settings({ onClose }: iSettingsProps) {
  const { user, token, clearAuth, setAuth } = useAuthStore()
  const navigate = useNavigate()

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(user?.full_name ?? '')
  const [profileError, setProfileError] = useState<string | null>(null)

  const updateProfileMutation = useMutation({
    mutationFn: (full_name: string) => patch<iUser>(`/users/${user?.id}`, { full_name }),
    onSuccess: (updated) => {
      if (user && token) setAuth({ ...user, full_name: updated.full_name }, token)
      setIsEditingName(false)
      setProfileError(null)
    },
    onError: (err: Error) => setProfileError(err.message),
  })

  function startEditingName() {
    setNameDraft(user?.full_name ?? '')
    setProfileError(null)
    setIsEditingName(true)
  }

  function saveName() {
    const trimmed = nameDraft.trim()
    if (trimmed.length < 2) {
      setProfileError('Name must be at least 2 characters.')
      return
    }
    updateProfileMutation.mutate(trimmed)
  }

  if (!user) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 74,
        left: 24,
        zIndex: 9999,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Backdrop Dismissal */}
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
          border: `1px solid ${T.mutedCream}`,
          padding: 20,
          animation: 'slideUp 0.15s ease-out forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          {isEditingName ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.mutedCream}`,
                  fontSize: 14, fontWeight: 700, color: T.inkPrimary, backgroundColor: T.panelBg,
                }}
              />
              {profileError && (
                <span style={{ fontSize: 11, color: T.rust, fontWeight: 600 }}>{profileError}</span>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={saveName}
                  disabled={updateProfileMutation.isPending}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                    backgroundColor: T.teal, color: T.white, fontSize: 11, fontWeight: 700,
                    cursor: updateProfileMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setIsEditingName(false); setProfileError(null) }}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${T.mutedCream}`,
                    backgroundColor: T.white, color: T.inkSecondary, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>
                {user.full_name || 'System User'}
              </h4>
              <button
                onClick={startEditingName}
                title="Edit profile name"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: T.inkGhost, display: 'flex', alignItems: 'center',
                }}
              >
                <EditIcon color="currentColor" />
              </button>
            </div>
          )}
          <p style={{ margin: '2px 0 0', fontSize: 11, color: T.inkGhost, wordBreak: 'break-all' }}>
            {user.email}
          </p>
        </div>

        <hr style={{ margin: 0, border: 'none', borderBottom: `3px solid ${T.mutedCream}60` }} />

        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            User Environment
          </span>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: T.inkSecondary }}>Business Name:</span>
              <span style={{ fontWeight: 700, color: T.inkPrimary, fontSize: 11 }}>
                {user.business_name || 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: T.inkSecondary }}>Business Context ID:</span>
              <span style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace", fontSize: 11, fontWeight: 600, color: T.inkPrimary }}>
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

        {/* Security Metadata */}
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

        {/* Logout Action */}
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