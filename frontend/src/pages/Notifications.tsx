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
function BellOffIcon() {
  return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.inkGhost} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}

type NotificationTone = 'action' | 'alert' | 'info'

interface iNotificationItem {
  id: string
  tone: NotificationTone
  title: string
  detail: string
  timestamp: string
}

const TONE_CFG: Record<NotificationTone, { bg: string; text: string; Icon: (p: { color: string }) => ReactElement }> = {
  action: { bg: '#FFF3E0', text: T.orange, Icon: ClockIcon },
  alert: { bg: '#FAE8E5', text: T.rust, Icon: AlertIcon },
  info: { bg: '#E0F0F0', text: T.deepTeal, Icon: CheckIcon },
}

/**
 * @component Notifications
 * @description Aggregates operationally relevant order activity — orders awaiting
 * action, recent cancellations, and recent deliveries — into a single feed. There is
 * no dedicated notifications table/endpoint yet, so this derives its feed from the
 * existing /orders list, scoped and sorted client-side.
 */
export function Notifications() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const activePage = 'notifications'
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
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

  const items = useMemo<iNotificationItem[]>(() => {
    const list: iNotificationItem[] = []

    for (const order of pendingPage?.items ?? []) {
      list.push({
        id: `pending-${order.id}`,
        tone: 'action',
        title: `${order.order_number} awaiting confirmation`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.created_at,
      })
    }
    for (const order of confirmedPage?.items ?? []) {
      list.push({
        id: `confirmed-${order.id}`,
        tone: 'action',
        title: `${order.order_number} ready to dispatch`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }
    for (const order of cancelledPage?.items ?? []) {
      list.push({
        id: `cancelled-${order.id}`,
        tone: 'alert',
        title: `${order.order_number} was cancelled`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }
    for (const order of deliveredPage?.items ?? []) {
      list.push({
        id: `delivered-${order.id}`,
        tone: 'info',
        title: `${order.order_number} delivered`,
        detail: `${order.client_name} — ${order.mineral_type} — ${fmtZAR(order.total_zar)}`,
        timestamp: order.updated_at,
      })
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [pendingPage, confirmedPage, cancelledPage, deliveredPage])

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
  }), [items])

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="notifications" searchValue={searchValue} onSearchChange={setSearchValue} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Summary strip */}
            <div style={{
              backgroundColor: T.white, borderRadius: 16, border: `1px solid ${T.mutedCream}60`,
              display: 'flex', overflow: 'hidden',
            }}>
              {[
                { label: 'Needs Action', value: counts.action, color: T.orange },
                { label: 'Alerts', value: counts.alert, color: T.rust },
                { label: 'Recently Delivered', value: counts.info, color: T.deepTeal },
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

            {/* Feed */}
            <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 24, border: `1px solid ${T.mutedCream}60` }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: T.inkPrimary, borderBottom: `1px solid ${T.panelBg}`, paddingBottom: 12 }}>
                Activity Feed
              </h3>

              {isLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500 }}>
                  Compiling notification stream...
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <BellOffIcon />
                  <p style={{ margin: 0, fontSize: 13, color: T.inkGhost, fontWeight: 500 }}>
                    {searchValue.trim()
                      ? `No notifications matching "${searchValue}".`
                      : 'No notifications right now — all quiet.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredItems.map((item) => {
                    const cfg = TONE_CFG[item.tone]
                    const Icon = cfg.Icon
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '14px 16px', borderRadius: 14, backgroundColor: T.panelBg,
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', backgroundColor: cfg.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon color={cfg.text} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.inkPrimary }}>{item.title}</span>
                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtRelative(item.timestamp)}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: T.inkSecondary }}>{item.detail}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Notifications