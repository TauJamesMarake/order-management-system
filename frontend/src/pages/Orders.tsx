import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { Order, iDashboardSummary, iPaginatedResult, iOrderFilters, OrderStatus } from '@/types'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { Settings } from '@/components/Settings'

import { T } from '@/components/ColorPalette'

export type ColorToken = typeof T
export type ColorTokenKey = keyof ColorToken

function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Status configuration mapping
const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: '#FEF0E8', text: '#9A3B0A', dot: T.orange, label: 'Pending' },
  confirmed: { bg: '#E0F0F0', text: '#0A4A4A', dot: T.teal, label: 'Confirmed' },
  dispatched: { bg: '#E0ECEC', text: '#0C3E3E', dot: T.deepTeal, label: 'Dispatched' },
  delivered: { bg: '#D4ECEC', text: '#0A4A4A', dot: T.success, label: 'Delivered' },
  cancelled: { bg: '#FAE8E5', text: '#6B1A10', dot: T.rust, label: 'Cancelled' },
}

const ROLE_CFG: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: '#FEF0E8', text: T.rust, label: 'Administrator' },
  clerk: { bg: '#E0F0F0', text: T.deepTeal, label: 'Clerk' },
  viewer: { bg: T.panelBg, text: T.inkSecondary, label: 'Viewer' },
}

// Custom Professional SVG Icons

function FilterIcon({ color }: { color: string }) {

  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
}
function AlertIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}

// Reusable custom component status pill
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { bg: T.panelBg, text: T.inkSecondary, dot: T.inkGhost, label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 30,
      backgroundColor: cfg.bg, color: cfg.text,
      fontSize: 12, fontWeight: 600, textTransform: 'capitalize'
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

interface iFilterState {
  search: string; status: string; mineralType: string
  dateFrom: string; dateTo: string; page: number
}
const FILTER_DEFAULTS: iFilterState = {
  search: '', status: '', mineralType: '', dateFrom: '', dateTo: '', page: 1,
}

export function OrdersPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [activePage, setActivePage] = useState('orders')
  const [filters, setFilters] = useState<iFilterState>(FILTER_DEFAULTS)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)


  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const { data: summary } = useQuery<iDashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => get<iDashboardSummary>('/orders/summary'),
    refetchInterval: 30_000,
    enabled: !!user,
  })

  const orderParams: iOrderFilters = {
    search: filters.search || undefined,
    status: (filters.status || undefined) as OrderStatus | undefined,
    mineral_type: filters.mineralType || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    page: filters.page,
    limit: 12,
  }

  const { data: ordersPage, isLoading: ordersLoading, isError } = useQuery<iPaginatedResult<Order>>({
    queryKey: ['orders', orderParams],
    queryFn: () => get<iPaginatedResult<Order>>('/orders', { params: orderParams }),
    enabled: !!user,
  })

  const setFilter = (key: keyof iFilterState, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleTabClick = (statusValue: string) => {
    setFilters((prev) => ({ ...prev, status: statusValue, page: 1 }))
  }

  const totalPages = ordersPage ? Math.ceil(ordersPage.total / ordersPage.limit) : 0

  if (!user) return null

  const roleStyle = ROLE_CFG[user.role] ?? { bg: T.panelBg, text: T.inkSecondary, label: user.role }
  const initials = user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  // Extract a list of recent items needing immediate processing to use inside the Calendar Reminder panel window
  const activeReminders = ordersPage?.items?.filter(o => o.status === 'pending' || o.status === 'confirmed').slice(0, 4) || []

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: T.mutedCream,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>

      <SideBar activePage={activePage} />
      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <TopBar title={activePage} searchValue={''} onSearchChange={function (v: string): void {
          throw new Error('Function not implemented.')
        }} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 32, alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, }}>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.mutedCream}80`, boxShadow: '0 4px 0px rgba(14,31,31,0.40)', paddingBottom: 4, overflowX: 'auto', }}>
              {[
                { label: 'All Orders', count: summary?.total_today ?? 0, value: '' },
                { label: 'Pending Action', count: summary?.by_status?.pending ?? 0, value: 'pending' },
                { label: 'Confirmed', count: summary?.by_status?.confirmed ?? 0, value: 'confirmed' },
                { label: 'Dispatched', count: summary?.by_status?.dispatched ?? 0, value: 'dispatched' },
                { label: 'Delivered', count: summary?.by_status?.delivered ?? 0, value: 'delivered' },
                { label: 'Cancelled', count: summary?.by_status?.cancelled ?? 0, value: 'cancelled' },
              ].map((tab) => {
                const isSelected = filters.status === tab.value

                return (
                  <button
                    key={tab.label}
                    onClick={() => handleTabClick(tab.value)}
                    style={{
                      padding: '10px 16px', borderRadius: '10px 10px 0 0', border: 'none',
                      backgroundColor: isSelected ? T.white : 'transparent',
                      color: isSelected ? T.deepTeal : T.inkSecondary,
                      fontWeight: isSelected ? 700 : 500, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease',
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

            <div style={{
              backgroundColor: T.white, borderRadius: 16, padding: '14px 20px',
              border: `1px solid ${T.mutedCream}60`,
              display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                <div style={{ width: '200px' }}>
                  <input
                    type="text"
                    placeholder="Product Commodity Type"
                    value={filters.mineralType}
                    onChange={(e) => setFilter('mineralType', e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, width: '100%', boxSizing: 'border-box', backgroundColor: T.panelBg }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilter('dateFrom', e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                  />
                  <span style={{ color: T.inkGhost, fontSize: 12 }}>to</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilter('dateTo', e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                  />
                </div>
              </div>

              <button
                onClick={() => setFilters(FILTER_DEFAULTS)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${T.mutedCream}`, backgroundColor: T.white, color: T.inkSecondary,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <FilterIcon color="currentColor" />
                Reset Controls
              </button>
            </div>

            <div style={{
              backgroundColor: T.white, borderRadius: 20,
              border: `1px solid ${T.mutedCream}60`, overflow: 'hidden'
            }}>

              {isError && (
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: `${T.rust}08`, borderBottom: `1px solid ${T.rust}15` }}>
                  <AlertIcon />
                  <span style={{ fontSize: 13, color: T.rust, fontWeight: 500 }}>System failed to retrieve requested ledger entries. Please check cloud sync logs.</span>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                {ordersLoading ? (
                  <div style={{ padding: '80px 0', textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500 }}>Loading distributed ledger pipeline matrix...</div>
                ) : !ordersPage || ordersPage.items.length === 0 ? (
                  <div style={{ padding: '80px 0', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, color: T.inkGhost, fontWeight: 500 }}>No register logs discovered fitting parameters.</p>
                    <button onClick={() => setFilters(FILTER_DEFAULTS)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.teal, fontWeight: 600, textDecoration: 'underline' }}>Clear Constraints</button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: T.panelBg, borderBottom: `1px solid ${T.mutedCream}` }}>
                        {['Order Ref ID', 'Client Account', 'Mineral Class', 'Quantity', 'Aggregate Price', 'Workflow State', 'Date Created'].map((heading, idx) => (
                          <th key={heading} style={{
                            padding: '16px 20px', fontSize: 11, fontWeight: 700, color: T.inkSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: idx === 3 || idx === 4 ? 'right' : 'left'
                          }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordersPage.items.map((order) => {
                        const isHovered = hoveredRow === order.id
                        return (
                          <tr
                            key={order.id}
                            onMouseEnter={() => setHoveredRow(order.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                            style={{
                              borderBottom: `1px solid ${T.panelBg}`,
                              backgroundColor: isHovered ? `${T.cream}25` : 'transparent',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: T.deepTeal }}>{order.order_number}</td>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.mutedCream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSecondary }}>{order.client_name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{order.client_name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: 13, color: T.inkSecondary, fontWeight: 500 }}>{order.mineral_type}</td>
                            <td style={{ padding: '16px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: T.inkSecondary }}>{Number(order.quantity_kg).toLocaleString('en-ZA')} kg</td>
                            <td style={{ padding: '16px 20px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: T.inkPrimary }}>{fmtZAR(Number(order.total_zar))}</td>
                            <td style={{ padding: '16px 20px' }}><StatusPill status={order.status} /></td>
                            <td style={{ padding: '16px 20px', fontSize: 12, color: T.inkGhost, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(order.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {ordersPage && totalPages > 1 && (
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.mutedCream}60`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.white }}>
                  <span style={{ fontSize: 12, color: T.inkSecondary, fontWeight: 500 }}>
                    Showing indexes {(ordersPage.page - 1) * ordersPage.limit + 1} to {Math.min(ordersPage.page * ordersPage.limit, ordersPage.total)} of {ordersPage.total} record tracks
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={filters.page === 1} onClick={() => setFilter('page', filters.page - 1)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, background: T.white, cursor: filters.page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Previous</button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button key={idx} onClick={() => setFilter('page', idx + 1)} style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none',
                        backgroundColor: filters.page === idx + 1 ? T.teal : 'transparent',
                        color: filters.page === idx + 1 ? T.white : T.inkPrimary,
                        fontWeight: 700, fontSize: 12, cursor: 'pointer'
                      }}>{idx + 1}</button>
                    ))}
                    <button disabled={filters.page >= totalPages} onClick={() => setFilter('page', filters.page + 1)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, background: T.white, cursor: filters.page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Next</button>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* REMINDERS WIDGET */}
            <div style={{
              backgroundColor: T.white, borderRadius: 24, padding: '24px',
              border: `1px solid ${T.mutedCream}60`,
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Critical Order Reminders</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.orange, backgroundColor: `${T.orange}10`, padding: '2px 8px', borderRadius: 20 }}>
                  {activeReminders.length} Urgent Tasks
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeReminders.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: T.inkGhost, fontSize: 12, fontWeight: 500 }}>
                    No pending items require operational verification.
                  </div>
                ) : (
                  activeReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 14,
                        backgroundColor: T.panelBg,
                        // borderLeft: `4px solid ${reminder.status === 'pending' ? T.orange : T.teal}`,
                        // borderRight: `4px solid ${reminder.status === 'pending' ? T.orange : T.teal}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.inkPrimary }}>{reminder.order_number}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.inkGhost }}>{fmtDate(reminder.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.inkSecondary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {reminder.client_name}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, fontSize: 11 }}>
                        <span style={{ color: T.inkGhost, fontWeight: 500 }}>Commodity: {reminder.mineral_type}</span>
                        <span style={{ color: T.inkPrimary, fontWeight: 700 }}>{fmtZAR(Number(reminder.total_zar))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </main>
      </div>
    </div >
  )
}

export default OrdersPage