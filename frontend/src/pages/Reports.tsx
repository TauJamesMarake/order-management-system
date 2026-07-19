import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iOrderSummary, OrderStatus } from '@/types'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { Settings } from '@/components/Settings'

import { T } from '@/components/ColorPalette'

function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'dispatched']

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/**
 * @component Reports
 * @description Analytics dashboard for admins. Fetches /reports/summary and binds
 * directly to iOrderSummary — the type the backend controller actually returns.
 */
export function Reports() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('reports')
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const { data: summary, isLoading, isError } = useQuery<iOrderSummary>({
    retry: 0,
    queryKey: ['reports-summary'],
    queryFn: () => get<iOrderSummary>('/reports/summary'),
    enabled: !!user && user.role === 'admin',
    staleTime: 60_000,
  })

  // by_mineral -> sorted array for charts/table
  const mineralEntries = useMemo(() => {
    return Object.entries(summary?.by_mineral ?? {})
      .map(([mineral, stats]) => ({ mineral, count: stats.count, value: stats.value }))
      .sort((a, b) => b.value - a.value)
  }, [summary?.by_mineral])

  const pieColors = useMemo(() => {
    const palette = [T.teal, T.orange, T.deepTeal, T.success, T.rust, T.inkSecondary]
    return mineralEntries.map((_, i) => palette[i % palette.length])
  }, [mineralEntries.length])

  const activeOrders = useMemo(() => {
    if (!summary) return 0
    return ACTIVE_STATUSES.reduce((sum, s) => sum + (summary.by_status[s] ?? 0), 0)
  }, [summary])

  const deliveredOrders = summary?.by_status.delivered ?? 0

  if (!user) return null

  if (user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <SideBar activePage={activePage} />
        {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar title="Access Denied" searchValue="" onSearchChange={() => { }} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div
              style={{
                backgroundColor: T.white,
                borderRadius: 20,
                padding: 48,
                textAlign: 'center',
                maxWidth: 480,
                border: `1px solid ${T.mutedCream}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 64, height: 64, margin: '0 auto' }}>
                <LockIcon />
              </div>
              <h2 style={{ margin: '16px 0 8px', color: T.rust, fontSize: 20, fontWeight: 700 }}>Administrative Clearance Required</h2>
              <p style={{ margin: 0, color: T.inkSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your profile scope ({user.role}) possesses insufficient authority attributes to aggregate live operational analytics parameters.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setIsExporting(format)
      window.open(`${import.meta.env.VITE_API_URL || ''}/api/reports/export/${format}`, '_blank')
    } catch (error) {
      console.error(`Export engine disruption reported over format stream compiler: ${format}`, error)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="reports" searchValue="" onSearchChange={() => { }} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 32, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Export action bar */}
            <div
              style={{
                backgroundColor: T.white,
                borderRadius: 16,
                padding: '20px',
                border: `1px solid ${T.mutedCream}60`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>Data Extraction Streams</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost }}>Exports are compiled directly in-memory and securely bounded by tenant context fields.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={isLoading || isExporting !== null}
                  onClick={() => handleExport('excel')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8,
                    border: `1px solid ${T.mutedCream}`, backgroundColor: T.white, color: T.deepTeal,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <DownloadIcon color="currentColor" />
                  Excel
                </button>
                <button
                  disabled={isLoading || isExporting !== null}
                  onClick={() => handleExport('pdf')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8,
                    border: 'none', backgroundColor: T.teal, color: T.white,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <DownloadIcon color="currentColor" />
                  PDF
                </button>
              </div>
            </div>

            {isLoading ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 80, textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500 }}>
                Loading ledger metrics...
              </div>
            ) : isError || !summary ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 40, textAlign: 'center', color: T.rust, fontSize: 14, fontWeight: 500, }}>
                Gateway routing anomaly occurred trying to aggregate requested data frames.
              </div>
            ) : (
              <>
                <div style={{
                  backgroundColor: T.white, borderRadius: 20,
                  border: `1px solid ${T.mutedCream}60`, display: 'flex', overflow: 'hidden',
                }}>
                  {[
                    { label: 'Total Value', value: fmtZAR(summary.total_value_zar) },
                    { label: 'Total Orders', value: summary.total_orders },
                    { label: 'Active Orders', value: activeOrders },
                    { label: 'Delivered', value: deliveredOrders },
                  ].map((stat, idx, arr) => (
                    <div
                      key={stat.label}
                      style={{
                        flex: 1, padding: '22px 28px',
                        borderRight: idx < arr.length - 1 ? `1px solid ${T.mutedCream}` : 'none',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</span>
                      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.inkPrimary }}>{stat.value}</h2>
                    </div>
                  ))}
                </div>

                {/* Status breakdown strip */}
                <div style={{
                  backgroundColor: T.white, borderRadius: 16, padding: '18px 24px',
                  border: `1px solid ${T.mutedCream}60`,
                  display: 'flex', gap: 28,
                  // flexWrap: 'wrap',
                }}>
                  {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((status) => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: T.inkPrimary }}>{summary.by_status[status] ?? 0}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.inkGhost }}>{STATUS_LABEL[status]}</span>
                    </div>
                  ))}
                </div>

                {/* Mineral distribution */}
                <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 24, border: `1px solid ${T.mutedCream}60` }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: T.inkPrimary, borderBottom: `1px solid ${T.panelBg}`, paddingBottom: 12 }}>
                    Yield Distribution Ledger
                  </h3>

                  {mineralEntries.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                      No order data available for the current period.
                    </div>
                  ) : (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                            <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase' }}>Mineral Type</th>
                            <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', textAlign: 'right' }}>Order Count</th>
                            <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', textAlign: 'right' }}>Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mineralEntries.map(({ mineral, count, value }) => (
                            <tr key={mineral} style={{ borderBottom: `1px solid ${T.panelBg}40` }}>
                              <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 600, color: T.inkSecondary }}>{mineral}</td>
                              <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 600, color: T.inkSecondary, textAlign: 'right' }}>{count}</td>
                              <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 700, color: T.inkPrimary, textAlign: 'right' }}>{fmtZAR(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'stretch' }}>

                        <div style={{ backgroundColor: T.panelBg, borderRadius: 16, border: `1px solid ${T.mutedCream}60`, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.inkPrimary }}>Value Share (Pie)</h4>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>{mineralEntries.length} minerals</span>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Tooltip
                                  formatter={(value: any, name: any) => [fmtZAR(Number(value)), String(name)]}
                                  labelFormatter={(label: any) => `mineral: ${String(label)}`}
                                  contentStyle={{ background: T.white, border: `1px solid ${T.mutedCream}`, borderRadius: 10 }}
                                />
                                <Pie
                                  data={mineralEntries}
                                  dataKey="value"
                                  nameKey="mineral"
                                  innerRadius={55}
                                  outerRadius={95}
                                  paddingAngle={2}
                                >
                                  {mineralEntries.map((_, idx) => (
                                    <Cell key={idx} fill={pieColors[idx]} />
                                  ))}
                                </Pie>
                                <Legend
                                  verticalAlign="bottom"
                                  height={36}
                                  formatter={(v: any) => <span style={{ color: T.inkSecondary, fontSize: 12, fontWeight: 600 }}>{v}</span>}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div style={{ backgroundColor: T.panelBg, borderRadius: 16, border: `1px solid ${T.mutedCream}60`, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.inkPrimary }}>Top minerals (Bar)</h4>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>Sorted</span>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer>
                              <BarChart data={mineralEntries.slice(0, 8)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={`${T.mutedCream}80`} />
                                <XAxis
                                  dataKey="mineral"
                                  tick={{ fill: T.inkGhost, fontSize: 11, fontWeight: 600 }}
                                  interval={0}
                                  tickLine={false}
                                  axisLine={{ stroke: `${T.mutedCream}80` }}
                                />
                                <YAxis
                                  tick={{ fill: T.inkGhost, fontSize: 11, fontWeight: 600 }}
                                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                                  axisLine={{ stroke: `${T.mutedCream}80` }}
                                />
                                <Tooltip
                                  formatter={(value: any) => [fmtZAR(Number(value))]}
                                  contentStyle={{ background: T.white, border: `1px solid ${T.mutedCream}`, borderRadius: 10 }}
                                />
                                <Legend
                                  verticalAlign="top"
                                  height={24}
                                  formatter={() => <span style={{ color: T.inkSecondary, fontSize: 12, fontWeight: 700 }}>Total value</span>}
                                />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                                  {mineralEntries.slice(0, 8).map((_, idx) => (
                                    <Cell key={`bar-${idx}`} fill={pieColors[idx]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Reports