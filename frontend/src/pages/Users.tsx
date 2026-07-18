import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { get, post, patch } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iUser, UserRole } from '@/types'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { Settings } from '@/components/Settings'
import { T } from '@/components/ColorPalette'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const ROLE_CFG: Record<UserRole, { bg: string; text: string; label: string }> = {
  admin: { bg: '#FEF0E8', text: T.rust, label: 'Administrator' },
  clerk: { bg: '#E0F0F0', text: T.deepTeal, label: 'Clerk' },
  viewer: { bg: T.panelBg, text: T.inkSecondary, label: 'Viewer' },
}

const STATUS_CFG: Record<'active' | 'inactive', { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: '#D4ECEC', text: '#0A4A4A', dot: T.success, label: 'Active' },
  inactive: { bg: '#FAE8E5', text: '#6B1A10', dot: T.rust, label: 'Inactive' },
}

function RolePill({ role }: { role: UserRole }) {
  const cfg = ROLE_CFG[role]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.text, fontSize: 11, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  )
}

function StatusPill({ isActive }: { isActive: boolean }) {
  const cfg = STATUS_CFG[isActive ? 'active' : 'inactive']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 30,
      backgroundColor: cfg.bg, color: cfg.text, fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function PlusIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function EditIcon({ color }: { color: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
function PowerIcon({ color }: { color: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
}
function CloseIcon({ color }: { color: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
function LockIcon() {
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}

interface iUserFormState {
  email: string
  password: string
  full_name: string
  role: UserRole
  is_active: boolean
}

const FORM_DEFAULTS: iUserFormState = {
  email: '', password: '', full_name: '', role: 'clerk', is_active: true,
}

type ModalMode = { kind: 'create' } | { kind: 'edit'; user: iUser } | null

export function Users() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [activePage] = useState('users')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')

  const [modal, setModal] = useState<ModalMode>(null)
  const [form, setForm] = useState<iUserFormState>(FORM_DEFAULTS)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) navigate('/login', { replace: true })
  }, [currentUser, navigate])

  const { data: users, isLoading, isError } = useQuery<iUser[]>({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: () => get<iUser[]>('/users', {
      params: {
        role: roleFilter || undefined,
        is_active: statusFilter ? statusFilter === 'active' : undefined,
      },
    }),
    enabled: !!currentUser && currentUser.role === 'admin',
  })

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: (dto: iUserFormState) => post<iUser>('/users', dto),
    onSuccess: () => { invalidateUsers(); closeModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<iUserFormState> }) => patch<iUser>(`/users/${id}`, dto),
    onSuccess: () => { invalidateUsers(); closeModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => patch<iUser>(`/users/${id}/deactivate`),
    onSuccess: invalidateUsers,
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => patch<iUser>(`/users/${id}/reactivate`),
    onSuccess: invalidateUsers,
  })

  function openCreate() {
    setForm(FORM_DEFAULTS)
    setFormError(null)
    setModal({ kind: 'create' })
  }

  function openEdit(u: iUser) {
    setForm({ email: u.email, password: '', full_name: u.full_name, role: u.role, is_active: u.is_active })
    setFormError(null)
    setModal({ kind: 'edit', user: u })
  }

  function closeModal() {
    setModal(null)
    setFormError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (modal?.kind === 'create') {
      createMutation.mutate(form)
      return
    }
    if (modal?.kind === 'edit') {
      const isSelf = modal.user.id === currentUser?.id
      const dto: Partial<iUserFormState> = { full_name: form.full_name }
      if (!isSelf) {
        dto.role = form.role
        dto.is_active = form.is_active
      }
      updateMutation.mutate({ id: modal.user.id, dto })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const editingIsSelf = modal?.kind === 'edit' && modal.user.id === currentUser?.id

  const counts = useMemo(() => {
    const list = users ?? []
    return {
      all: list.length,
      active: list.filter(u => u.is_active).length,
      inactive: list.filter(u => !u.is_active).length,
    }
  }, [users])

  if (!currentUser) return null

  if (currentUser.role !== 'admin') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <SideBar activePage={activePage} />
        {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar title="Access Denied" searchValue="" onSearchChange={() => { }} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{
              backgroundColor: T.white, borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 480,
              boxShadow: '0 4px 20px rgba(14,31,31,0.61)', border: `1px solid ${T.mutedCream}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 64, height: 64, margin: '0 auto' }}>
                <LockIcon />
              </div>
              <h2 style={{ margin: '16px 0 8px', color: T.rust, fontSize: 20, fontWeight: 700 }}>Administrative Clearance Required</h2>
              <p style={{ margin: 0, color: T.inkSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your profile scope ({currentUser.role}) possesses insufficient authority attributes to manage personnel accounts.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="users" searchValue="" onSearchChange={() => { }} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Status tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.mutedCream}80`, boxShadow: '0 4px 0px rgba(14,31,31,0.40)', paddingBottom: 4 }}>
                {[
                  { label: 'All Personnel', value: '' as const, count: counts.all },
                  { label: 'Active', value: 'active' as const, count: counts.active },
                  { label: 'Inactive', value: 'inactive' as const, count: counts.inactive },
                ].map((tab) => {
                  const isSelected = statusFilter === tab.value
                  return (
                    <button
                      key={tab.label}
                      onClick={() => setStatusFilter(tab.value)}
                      style={{
                        padding: '10px 16px', borderRadius: '10px 10px 0 0', border: 'none',
                        backgroundColor: isSelected ? T.white : 'transparent',
                        color: isSelected ? T.deepTeal : T.inkSecondary,
                        fontWeight: isSelected ? 700 : 500, fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {tab.label}
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 20,
                        backgroundColor: isSelected ? `${T.deepTeal}15` : T.panelBg,
                        color: isSelected ? T.deepTeal : T.inkGhost, fontWeight: 700,
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={openCreate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: T.teal,
                  color: T.white,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <PlusIcon color={T.white} />
                New User
              </button>
            </div>

            {/* Role filter */}
            <div style={{
              backgroundColor: T.white, borderRadius: 16, padding: '14px 20px',
              border: `1px solid ${T.mutedCream}60`,
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Filter by role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as '' | UserRole)}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg, color: T.inkPrimary }}
              >
                <option value="">All roles</option>
                <option value="admin">Administrator</option>
                <option value="clerk">Clerk</option>
                <option value="viewer">Viewer</option>
              </select>
              {(roleFilter || statusFilter) && (
                <button
                  onClick={() => { setRoleFilter(''); setStatusFilter('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.teal, fontWeight: 600, textDecoration: 'underline', marginLeft: 'auto' }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Personnel registry table */}
            <div style={{
              backgroundColor: T.white, borderRadius: 20,
              border: `1px solid ${T.mutedCream}60`, overflow: 'hidden',
            }}>
              {isError && (
                <div style={{ padding: '14px 20px', backgroundColor: `${T.rust}08`, borderBottom: `1px solid ${T.rust}15` }}>
                  <span style={{ fontSize: 13, color: T.rust, fontWeight: 500 }}>Failed to retrieve personnel registry.</span>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                {isLoading ? (
                  <div style={{ padding: '80px 0', textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500 }}>
                    Compiling registry...
                  </div>
                ) : !users || users.length === 0 ? (
                  <div style={{ padding: '80px 0', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, color: T.inkGhost, fontWeight: 500 }}>No personnel records match current parameters.</p>
                    <button onClick={() => { setRoleFilter(''); setStatusFilter('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.teal, fontWeight: 600, textDecoration: 'underline' }}>Clear Constraints</button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: T.panelBg, borderBottom: `1px solid ${T.mutedCream}` }}>
                        {['Name', 'Email', 'Role', 'Status', 'Joined', ''].map((heading, idx) => (
                          <th key={heading || idx} style={{
                            padding: '16px 20px', fontSize: 11, fontWeight: 700, color: T.inkSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u.id === currentUser.id
                        return (
                          <tr key={u.id} style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.mutedCream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSecondary }}>{u.full_name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{u.full_name}</span>
                                {isSelf && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: T.inkGhost, backgroundColor: T.panelBg, padding: '2px 6px', borderRadius: 20 }}>You</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: 13, color: T.inkSecondary, fontWeight: 500 }}>{u.email}</td>
                            <td style={{ padding: '16px 20px' }}><RolePill role={u.role} /></td>
                            <td style={{ padding: '16px 20px' }}><StatusPill isActive={u.is_active} /></td>
                            <td style={{ padding: '16px 20px', fontSize: 12, color: T.inkGhost, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => openEdit(u)}
                                  title="Edit user"
                                  style={{
                                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.mutedCream}`,
                                    backgroundColor: T.white, color: T.inkSecondary, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <EditIcon color="currentColor" />
                                </button>
                                <button
                                  disabled={isSelf}
                                  title={isSelf ? 'You cannot deactivate your own account' : (u.is_active ? 'Deactivate user' : 'Reactivate user')}
                                  onClick={() => u.is_active ? deactivateMutation.mutate(u.id) : reactivateMutation.mutate(u.id)}
                                  style={{
                                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.mutedCream}`,
                                    backgroundColor: T.white,
                                    color: isSelf ? T.inkGhost : (u.is_active ? T.rust : T.success),
                                    cursor: isSelf ? 'not-allowed' : 'pointer',
                                    opacity: isSelf ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <PowerIcon color="currentColor" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(14,31,31,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0 }} />
          <form
            onSubmit={handleSubmit}
            style={{
              position: 'relative', width: 440, backgroundColor: T.white, borderRadius: 20,
              padding: 28, boxShadow: '0 20px 60px rgba(14,31,31,0.45)', border: `1px solid ${T.mutedCream}`,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.inkPrimary }}>
                {modal.kind === 'create' ? 'New Personnel Record' : 'Edit Personnel Record'}
              </h3>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkGhost, padding: 4 }}>
                <CloseIcon color="currentColor" />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${T.rust}10`, color: T.rust, fontSize: 12, fontWeight: 600 }}>
                {formError}
              </div>
            )}

            {editingIsSelf && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${T.orange}10`, color: '#9A3B0A', fontSize: 12, fontWeight: 600 }}>
                You're editing your own account — role and status are locked to prevent accidental self-lockout.
              </div>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Full Name</span>
              <input
                required
                minLength={2}
                value={form.full_name}
                onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
              />
            </label>

            {modal.kind === 'create' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Email</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Temporary Password</span>
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                  />
                </label>
              </>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Role</span>
              <select
                disabled={editingIsSelf}
                value={form.role}
                onChange={(e) => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13,
                  backgroundColor: editingIsSelf ? T.mutedCream : T.panelBg,
                  color: T.inkPrimary, cursor: editingIsSelf ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="admin">Administrator</option>
                <option value="clerk">Clerk</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>

            {modal.kind === 'edit' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  disabled={editingIsSelf}
                  checked={form.is_active}
                  onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Account active</span>
              </label>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${T.mutedCream}`,
                  backgroundColor: T.white, color: T.inkSecondary, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                  backgroundColor: T.teal, color: T.white, fontSize: 13, fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Saving...' : modal.kind === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Users