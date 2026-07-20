import { useState, useEffect, useMemo, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iOrder, iPaginatedResult } from '@/types'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { T } from '@/components/ColorPalette'

function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

function ClockIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
function AlertIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}
function CheckIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
}
function PinIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
}
function BellOffIcon() {
  return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.inkGhost} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}
function PlusIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function EditIcon({ color }: { color: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
function TrashIcon({ color }: { color: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
}
function CloseIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}

type NotificationTone = 'action' | 'alert' | 'info' | 'reminder'

interface iNotificationItem {
  id: string
  tone: NotificationTone
  title: string
  detail: string
  timestamp: string
  /** Custom (user-created) reminders can be edited/deleted; order-derived ones can only be dismissed. */
  isCustom: boolean
  done?: boolean
}

interface iCustomReminder {
  id: string
  title: string
  detail: string
  createdAt: string
  done: boolean
}

const TONE_CFG: Record<NotificationTone, { bg: string; text: string; Icon: (p: { color: string }) => ReactElement }> = {
  action: { bg: '#FFF3E0', text: T.orange, Icon: ClockIcon },
  alert: { bg: '#FAE8E5', text: T.rust, Icon: AlertIcon },
  info: { bg: '#E0F0F0', text: T.deepTeal, Icon: CheckIcon },
  reminder: { bg: '#EDE7F6', text: '#6B4FBB', Icon: PinIcon },
}

// ── Local persistence helpers ──────────────────────────────────────────────
// There is no backend notifications table yet, so custom reminders and
// dismissed-notification state are kept in localStorage, namespaced per
// business so different tenants sharing a browser don't see each other's data.
function remindersKey(businessId: string) {
  return `oms_reminders_${businessId}`
}
function dismissedKey(businessId: string) {
  return `oms_dismissed_notifications_${businessId}`
}

function loadReminders(businessId: string): iCustomReminder[] {
  try {
    const raw = localStorage.getItem(remindersKey(businessId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function saveReminders(businessId: string, reminders: iCustomReminder[]) {
  localStorage.setItem(remindersKey(businessId), JSON.stringify(reminders))
}
function loadDismissed(businessId: string): string[] {
  try {
    const raw = localStorage.getItem(dismissedKey(businessId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function saveDismissed(businessId: string, ids: string[]) {
  localStorage.setItem(dismissedKey(businessId), JSON.stringify(ids))
}

interface iReminderFormState {
  title: string
  detail: string
}
const REMINDER_FORM_DEFAULTS: iReminderFormState = { title: '', detail: '' }

type ReminderModalMode = { kind: 'create' } | { kind: 'edit'; reminder: iCustomReminder } | null

/**
 * @component Notifications
 * @description Aggregates operationally relevant order activity — orders awaiting
 * action, recent cancellations, recent deliveries — with user-created reminders into
 * a single feed. Order-derived items can be dismissed (hidden locally); custom
 * reminders support full create/edit/delete. There is no dedicated notifications
 * table/endpoint yet, so both the order-derived feed and the reminder/dismissal
 * state are handled client-side (orders from /orders, reminders/dismissals in
 * localStorage, namespaced per business).
 */
export function Notifications() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const activePage = 'notifications'
  const [searchValue, setSearchValue] = useState('')

  const [reminders, setReminders] = useState<iCustomReminder[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [reminderModal, setReminderModal] = useState<ReminderModalMode>(null)
  const [reminderForm, setReminderForm] = useState<iReminderFormState>(REMINDER_FORM_DEFAULTS)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    setReminders(loadReminders(user.business_id))
    setDismissed(loadDismissed(user.business_id))
  }, [user, navigate])

  const { data: pendingPage, isLoading: pendingLoading } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['notifications-pending'],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { status: 'pending', limit: 20, page: 1 } }),
    enabled: !!user,
  })

  const { data: confirmedPage, isLoading: confirmedLoading } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['notifications-confirmed'],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { status: 'confirmed', limit: 20, page: 1 } }),
    enabled: !!user,
  })

  const { data: cancelledPage, isLoading: cancelledLoading } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['notifications-cancelled'],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { status: 'cancelled', limit: 10, page: 1 } }),
    enabled: !!user,
  })

  const { data: deliveredPage, isLoading: deliveredLoading } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['notifications-delivered'],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { status: 'delivered', limit: 10, page: 1 } }),
    enabled: !!user,
  })

  const isLoading = pendingLoading || confirmedLoading || cancelledLoading || deliveredLoading

  // ── CRUD: custom reminders ────────────────────────────────────────────
  function persistReminders(next: iCustomReminder[]) {
    if (!user) return
    setReminders(next)
    saveReminders(user.business_id, next)
  }

  function createReminder(form: iReminderFormState) {
    const newReminder: iCustomReminder = {
      id: `reminder-${Date.now()}`,
      title: form.title.trim(),
      detail: form.detail.trim(),
      createdAt: new Date().toISOString(),
      done: false,
    }
    persistReminders([newReminder, ...reminders])
  }

  function updateReminder(id: string, form: iReminderFormState) {
    persistReminders(reminders.map((r) => r.id === id ? { ...r, title: form.title.trim(), detail: form.detail.trim() } : r))
  }

  function toggleReminderDone(id: string) {
    persistReminders(reminders.map((r) => r.id === id ? { ...r, done: !r.done } : r))
  }

  function deleteReminder(id: string) {
    persistReminders(reminders.filter((r) => r.id !== id))
  }

  // ── Delete (dismiss): order-derived notifications ─────────────────────
  function dismissNotification(id: string) {
    if (!user) return
    const next = [...dismissed, id]
    setDismissed(next)
    saveDismissed(user.business_id, next)
  }

  function openCreateReminder() {
    setReminderForm(REMINDER_FORM_DEFAULTS)
    setReminderModal({ kind: 'create' })
  }
  function openEditReminder(reminder: iCustomReminder) {
    setReminderForm({ title: reminder.title, detail: reminder.detail })
    setReminderModal({ kind: 'edit', reminder })
  }
  function closeReminderModal() {
    setReminderModal(null)
  }
  function handleReminderSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reminderForm.title.trim()) return
    if (reminderModal?.kind === 'create') createReminder(reminderForm)
    if (reminderModal?.kind === 'edit') updateReminder(reminderModal.reminder.id, reminderForm)
    closeReminderModal()
  }

  const items = useMemo<iNotificationItem[]>(() => {
    const list: iNotificationItem[] = []

    for (const order of pendingPage?.items ?? []) {
      list.push({
        id: `pending-${order.id}`, tone: 'action', isCustom: false,
        title: `${order.order_number} awaiting confirmation`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.created_at,
      })
    }
    for (const order of confirmedPage?.items ?? []) {
      list.push({
        id: `confirmed-${order.id}`, tone: 'action', isCustom: false,
        title: `${order.order_number} ready to dispatch`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }
    for (const order of cancelledPage?.items ?? []) {
      list.push({
        id: `cancelled-${order.id}`, tone: 'alert', isCustom: false,
        title: `${order.order_number} was cancelled`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }
    for (const order of deliveredPage?.items ?? []) {
      list.push({
        id: `delivered-${order.id}`, tone: 'info', isCustom: false,
        title: `${order.order_number} delivered`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }
    for (const reminder of reminders) {
      list.push({
        id: reminder.id, tone: 'reminder', isCustom: true, done: reminder.done,
        title: reminder.title,
        detail: reminder.detail || 'No further details added.',
        timestamp: reminder.createdAt,
      })
    }

    return list
      .filter((item) => !dismissed.includes(item.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [pendingPage, confirmedPage, cancelledPage, deliveredPage, reminders, dismissed])

  const filteredItems = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) =>
      item.title.toLowerCase().includes(term) || item.detail.toLowerCase().includes(term)
    )
  }, [items, searchValue])

  const counts = useMemo(() => ({
    action: items.filter((i) => i.tone === 'action').length,
    alert: items.filter((i) => i.tone === 'alert').length,
    info: items.filter((i) => i.tone === 'info').length,
    reminder: items.filter((i) => i.tone === 'reminder').length,
  }), [items])

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="notifications" searchValue={searchValue} onSearchChange={setSearchValue} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary strip */}
            <div style={{
              backgroundColor: T.white, borderRadius: 16, border: `1px solid ${T.mutedCream}60`,
              display: 'flex', overflow: 'hidden',
            }}>
              {[
                { label: 'Needs Action', value: counts.action, color: T.orange },
                { label: 'Alerts', value: counts.alert, color: T.rust },
                { label: 'Recently Delivered', value: counts.info, color: T.deepTeal },
                { label: 'Reminders', value: counts.reminder, color: '#6B4FBB' },
              ].map((stat, idx, arr) => (
                <div
                  key={stat.label}
                  style={{
                    flex: 1, padding: '16px 20px',
                    borderRight: idx < arr.length - 1 ? `1px solid ${T.mutedCream}` : 'none',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{isLoading ? '—' : stat.value}</span>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>
                Activity Feed
              </h3>
              <button
                onClick={openCreateReminder}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
                  border: 'none', backgroundColor: T.teal, color: T.white,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <PlusIcon color={T.white} />
                Add Reminder
              </button>
            </div>

            {/* Feed — each notification is its own separated card */}
            {isLoading ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500, border: `1px solid ${T.mutedCream}60` }}>
                Compiling notification stream...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{
                backgroundColor: T.white, borderRadius: 20, padding: '60px 0', border: `1px solid ${T.mutedCream}60`,
                textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <BellOffIcon />
                <p style={{ margin: 0, fontSize: 13, color: T.inkGhost, fontWeight: 500 }}>
                  {searchValue.trim()
                    ? `No notifications matching "${searchValue}".`
                    : 'No notifications right now — all quiet.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredItems.map((item) => {
                  const cfg = TONE_CFG[item.tone]
                  const Icon = cfg.Icon
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '16px 18px', borderRadius: 16, backgroundColor: T.white,
                        border: `1px solid ${T.mutedCream}60`,
                        opacity: item.done ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', backgroundColor: cfg.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon color={cfg.text} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 700, color: T.inkPrimary,
                            textDecoration: item.done ? 'line-through' : 'none',
                          }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtRelative(item.timestamp)}</span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: T.inkSecondary }}>{item.detail}</p>
                        {item.isCustom && (
                          <span style={{
                            display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700,
                            color: '#6B4FBB', backgroundColor: '#EDE7F6', padding: '2px 8px', borderRadius: 20,
                          }}>
                            Custom Reminder
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {item.isCustom ? (
                          <>
                            <button
                              onClick={() => toggleReminderDone(item.id)}
                              title={item.done ? 'Mark as not done' : 'Mark as done'}
                              style={{
                                width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.mutedCream}`,
                                backgroundColor: T.white, color: item.done ? T.success : T.inkGhost, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <CheckIcon color="currentColor" />
                            </button>
                            <button
                              onClick={() => {
                                const reminder = reminders.find((r) => r.id === item.id)
                                if (reminder) openEditReminder(reminder)
                              }}
                              title="Edit reminder"
                              style={{
                                width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.mutedCream}`,
                                backgroundColor: T.white, color: T.inkSecondary, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <EditIcon color="currentColor" />
                            </button>
                            <button
                              onClick={() => deleteReminder(item.id)}
                              title="Delete reminder"
                              style={{
                                width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.mutedCream}`,
                                backgroundColor: T.white, color: T.rust, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <TrashIcon color="currentColor" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => dismissNotification(item.id)}
                            title="Dismiss notification"
                            style={{
                              width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.mutedCream}`,
                              backgroundColor: T.white, color: T.inkGhost, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <CloseIcon color="currentColor" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create / Edit reminder modal */}
      {reminderModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(14,31,31,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={closeReminderModal} style={{ position: 'absolute', inset: 0 }} />
          <form
            onSubmit={handleReminderSubmit}
            style={{
              position: 'relative', width: 420, backgroundColor: T.white, borderRadius: 20,
              padding: 28, border: `1px solid ${T.mutedCream}`,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.inkPrimary }}>
                {reminderModal.kind === 'create' ? 'New Reminder' : 'Edit Reminder'}
              </h3>
              <button type="button" onClick={closeReminderModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkGhost, padding: 4 }}>
                <CloseIcon color="currentColor" />
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Title</span>
              <input
                required
                autoFocus
                value={reminderForm.title}
                onChange={(e) => setReminderForm(f => ({ ...f, title: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Details (optional)</span>
              <textarea
                rows={3}
                maxLength={300}
                value={reminderForm.detail}
                onChange={(e) => setReminderForm(f => ({ ...f, detail: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={closeReminderModal}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${T.mutedCream}`,
                  backgroundColor: T.white, color: T.inkSecondary, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                  backgroundColor: T.teal, color: T.white, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {reminderModal.kind === 'create' ? 'Add Reminder' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Notifications