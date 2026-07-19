import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import { SideBar } from '@/components/SideBar'
import { Settings } from '@/components/Settings'
import { T } from '@/components/ColorPalette'
import type { iOrder, iDashboardSummary, iPaginatedResult, iOrderFilters, OrderStatus } from '@/types'
import { TopBar } from '@/components/TopBar'
import { CalendarWidget } from '@/components/Calendar'


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

// Status configuration
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

function AlertIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { bg: T.panelBg, text: T.inkSecondary, dot: T.inkGhost, label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 30,
      backgroundColor: cfg.bg, color: cfg.text,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function CompactStatCard({ label, value, sub, color, loading }: { label: string; value: string | number; sub?: string; color: string; loading?: boolean }) {
  return (
    <div style={{
      backgroundColor: T.white, borderRadius: 16, padding: '16px 20px',
      border: `1px solid ${T.mutedCream}60`,
      display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden'
    }}>
      <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: T.inkPrimary }}>{loading ? '—' : value}</span>
      {sub && <span style={{ fontSize: 11, color: T.inkSecondary }}>{sub}</span>}
    </div>
  )
}

interface iFilterState {
  search: string; status: string; mineralType: string
  dateFrom: string; dateTo: string; page: number
}
const FILTER_DEFAULTS: iFilterState = {
  search: '', status: '', mineralType: '', dateFrom: '', dateTo: '', page: 1,
}

const fieldStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10,
  border: `1px solid ${T.mutedCream}`,
  fontSize: 13, fontFamily: 'inherit',
  color: T.inkPrimary, backgroundColor: T.panelBg,
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('dashboard')

  const [filters, setFilters] = useState<iFilterState>(FILTER_DEFAULTS)
  const [onlineUsers, setOnlineUsers] = useState(1)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)


  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const t = setInterval(() => setOnlineUsers(Math.floor(Math.random() * 4) + 1), 7000)
    return () => clearInterval(t)
  }, [])

  const { data: summary, isLoading: summaryLoading } = useQuery<iDashboardSummary>({
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
    limit: 10, // Optimised for Mediline double-column layout view
  }

  const { data: ordersPage, isLoading: ordersLoading, isError } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['orders', orderParams],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: orderParams }),
    enabled: !!user,
  })

  const setFilter = (key: keyof iFilterState, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const totalPages = ordersPage ? Math.ceil(ordersPage.total / ordersPage.limit) : 0

  if (!user) return null

  const roleStyle = ROLE_CFG[user.role] ?? { bg: T.panelBg, text: T.inkSecondary, label: user.role }
  const initials = user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  // Pull top upcoming orders as interactive reminders
  const reminderOrders = ordersPage?.items.filter(o => o.status === 'pending' || o.status === 'confirmed').slice(0, 3) ?? []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <SideBar activePage={activePage} />

      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}


      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <TopBar title={activePage} searchValue={''} onSearchChange={function (v: string): void {
          throw new Error('Function not implemented.')
        }} />

        <main style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 24 }}>

            <div style={{
              backgroundColor: T.white, borderRadius: 24, padding: '24px',
              border: `1px solid ${T.mutedCream}60`,
              display: 'flex', alignItems: 'center', gap: 20, position: 'relative'
            }}>

              <div>
                <span style={{ fontSize: 11, color: T.inkSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Aggregate Value</span>
                <h2 style={{ margin: '4px 0', fontSize: 26, fontWeight: 800, color: T.inkPrimary }}>
                  {summaryLoading ? 'Calculating...' : fmtZAR(summary?.total_value_active_zar ?? 0)}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: T.inkSecondary }}>Pending, Confirmed, & Dispatched assets value currently inside the system pipelines.</p>
              </div>
            </div>

            {/* Statistical Data Layout Matrix Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <CompactStatCard label="Orders Today" value={summary?.total_today ?? 0} color={T.orange} loading={summaryLoading} />
              <CompactStatCard label="Awaiting Action" value={summary?.by_status?.pending ?? 0} sub="Pending status" color={T.warning} loading={summaryLoading} />
              <CompactStatCard label="In Transit Pipeline" value={(summary?.by_status?.dispatched ?? 0) + (summary?.by_status?.confirmed ?? 0)} sub="Confirmed & Dispatched" color={T.deepTeal} loading={summaryLoading} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, alignItems: 'start' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              <div style={{
                backgroundColor: T.white, borderRadius: 20, padding: '20px',
                border: `1px solid ${T.mutedCream}50`
              }}>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} style={fieldStyle}>
                      <option value="">All Statuses</option>
                      {Object.entries(STATUS_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <input type="text" placeholder="Filter Mineral Type" value={filters.mineralType} onChange={(e) => setFilter('mineralType', e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} style={fieldStyle} />
                  </div>
                  <button onClick={() => setFilters(FILTER_DEFAULTS)} style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none', backgroundColor: T.cream,
                    color: T.inkPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                    Clear Filters
                  </button>
                </div>
              </div>

              <div style={{
                backgroundColor: T.white,
                borderRadius: 24,
                border: `1px solid ${T.mutedCream}60`, overflow: 'hidden'
              }}>
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.mutedCream}60`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Order Register Ledger</span>
                  {ordersPage && <span style={{ fontSize: 12, fontWeight: 600, color: T.inkGhost, backgroundColor: T.panelBg, padding: '4px 10px', borderRadius: 20 }}>{ordersPage.total} Orders Registered</span>}
                </div>

                {isError && (
                  <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: `${T.rust}10`, borderBottom: `1px solid ${T.rust}20` }}>
                    <AlertIcon />
                    <span style={{ fontSize: 13, color: T.rust, fontWeight: 500 }}>System was unable to synchronise recent ledger changes. Please refresh connection.</span>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  {ordersLoading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500 }}>Synchronising secure pipeline ledger stream...</div>
                  ) : !ordersPage || ordersPage.items.length === 0 ? (
                    <div style={{ padding: '60px 0', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 14, color: T.inkGhost, fontWeight: 500 }}>No register entries match specified filter metrics.</p>
                      <button onClick={() => setFilters(FILTER_DEFAULTS)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.teal, fontWeight: 600, textDecoration: 'underline' }}>Reset Ledger Constraints</button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: T.panelBg, borderBottom: `1px solid ${T.mutedCream}` }}>
                          {['ID Code', 'Client Account', 'Commodity', 'Mass (KG)', 'Valuation ZAR', 'Status Flag', 'Timestamp'].map((h, i) => (
                            <th key={h} style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: T.inkSecondary, textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: i === 3 || i === 4 ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ordersPage.items.map((order) => (
                          <tr key={order.id} style={{ borderBottom: `1px solid ${T.panelBg}`, transition: 'all 0.15s' }}>
                            <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: T.deepTeal }}>{order.order_number}</td>
                            <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{order.client_name}</td>
                            <td style={{ padding: '14px 20px', fontSize: 13, color: T.inkSecondary }}>{order.mineral_type}</td>
                            <td style={{ padding: '14px 20px', fontSize: 13, textAlign: 'right', fontWeight: 500, color: T.inkSecondary }}>{Number(order.quantity_kg).toLocaleString('en-ZA')}</td>
                            <td style={{ padding: '14px 20px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: T.inkPrimary }}>{fmtZAR(Number(order.total_zar))}</td>
                            <td style={{ padding: '14px 20px' }}><StatusPill status={order.status} /></td>
                            <td style={{ padding: '14px 20px', fontSize: 12, color: T.inkGhost, whiteSpace: 'nowrap' }}>{fmtDate(order.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {ordersPage && totalPages > 1 && (
                  <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.mutedCream}60`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.panelBg }}>
                    <span style={{ fontSize: 12, color: T.inkSecondary, fontWeight: 500 }}>
                      Displaying indices {(ordersPage.page - 1) * ordersPage.limit + 1} to {Math.min(ordersPage.page * ordersPage.limit, ordersPage.total)} of aggregate {ordersPage.total} data points
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button disabled={filters.page === 1} onClick={() => setFilter('page', filters.page - 1)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, background: T.white, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Prev</button>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button key={i} onClick={() => setFilter('page', i + 1)} style={{
                          width: 32, height: 32, borderRadius: 8, border: 'none',
                          backgroundColor: filters.page === i + 1 ? T.teal : 'transparent',
                          color: filters.page === i + 1 ? T.white : T.inkPrimary,
                          fontWeight: 600, fontSize: 12, cursor: 'pointer'
                        }}>{i + 1}</button>
                      ))}
                      <button disabled={filters.page >= totalPages} onClick={() => setFilter('page', filters.page + 1)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, background: T.white, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

              <CalendarWidget />

              <div style={{
                backgroundColor: T.white, borderRadius: 24, padding: '24px',
                border: `1px solid ${T.mutedCream}60`,
                display: 'flex', flexDirection: 'column', gap: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Action Reminders</span>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: `${T.orange}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.orange }}>{reminderOrders.length}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reminderOrders.length === 0 ? (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: T.inkGhost, fontSize: 12, fontWeight: 500 }}>
                      No active processing alerts or pending reminders discovered.
                    </div>
                  ) : (
                    reminderOrders.map((order) => (
                      <div key={order.id} style={{
                        padding: '12px 14px', borderRadius: 14, backgroundColor: T.panelBg,
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.inkPrimary }}>{order.order_number} — {order.client_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: order.status === 'pending' ? T.orange : T.teal, textTransform: 'capitalize' }}>{order.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.inkSecondary }}>
                          <span>Commodity Asset: {order.mineral_type}</span>
                          <span style={{ fontWeight: 600 }}>{fmtZAR(Number(order.total_zar))}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>
    </div>
  )
}

export default Dashboard