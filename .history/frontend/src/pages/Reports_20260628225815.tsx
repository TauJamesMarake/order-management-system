Here is the updated code for your `Reports.tsx` component. The bottom summary bar has been appended and successfully modified to include the custom layout rendering parameters from your snippet, styled cleanly with your existing color tokens (`T`):

```tsx
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
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { T } from '@/components/ColorPalette'

/**
 * @interface iReportSummary
 * @description Strongly typed payload abstraction returned via backend metric generation endpoints.
 */
interface iReportSummary {
  total_revenue_zar: number
  total_orders_count: number
  fulfilled_orders_count: number
  active_clients_count: number
  revenue_by_product: Record<string, number>
}

/**
 * @function fmtZAR
 * @description Converts numeric indicators into localized South African Rand standard presentation format.
 * @param {number} n - Raw transactional amount.
 * @returns {string} Formatted currency representation.
 */
function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Presentation Icon Components
 */
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
 * @description Core analytics framework component. Renders isolated business-intelligence metrics, 
 * distribution visuals, and stream data compiler integrations for verified administrators.
 */
export function Reports() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('reports')
  const [isExporting, setIsExporting] = useState<string | null>(null)

  /**
   * Evaluates authentication token presence or updates redirection target context on check failure.
   */
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  /**
   * Coordinates fetching process logic for active scope tenant indicators.
   */
  const { data: summary, isLoading, isError } = useQuery<iReportSummary>({
    retry: 0,
    queryKey: ['reports-summary'],
    queryFn: () => get<iReportSummary>('/reports/summary'),
    enabled: !!user && user.role === 'admin',
    staleTime: 60_000,
  })

  /**
   * @description Derives a sorted data map mapping explicit payload fields into Recharts key configurations.
   */
  const productEntries = useMemo(() => {
    return Object.entries(summary?.revenue_by_product ?? {})
      .map(([product, total]) => ({ product, value: total }))
      .sort((a, b) => b.value - a.value)
  }, [summary?.revenue_by_product])

  /**
   * @description Assembles color array references bounded within core style guidelines.
   */
  const pieColors = useMemo(() => {
    const palette = [T.teal, T.orange, T.deepTeal, T.success, T.rust, T.inkSecondary]
    const out: string[] = []
    for (let i = 0; i < productEntries.length; i++) out.push(palette[i % palette.length])
    return out
  }, [productEntries.length])

  if (!user) return null

  /**
   * Multi-Tenant Gatekeeper Check: Intercepts non-privileged actors prior to visualization processing.
   */
  if (user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <SideBar activePage={activePage} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar title="Access Restrained" searchValue="" onSearchChange={() => { }} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div
              style={{
                backgroundColor: T.white,
                borderRadius: 20,
                padding: 48,
                textAlign: 'center',
                maxWidth: 480,
                boxShadow: '0 4px 20px rgba(14,31,31,0.40)',
                border: `1px solid ${T.mutedCream}`,
              }}
            >
              <LockIcon />
              <h2 style={{ margin: '16px 0 8px', color: T.rust, fontSize: 20, fontWeight: 700 }}>Administrative Clearance Required</h2>
              <p style={{ margin: 0, color: T.inkSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your active tenant configuration profile scope ({user.role}) possesses insufficient authority attributes to aggregate live operational analytics parameters.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  /**
   * @function handleExport
   * @description Directs browser content target streams towards file generation pipeline modules.
   * @param {'excel' | 'pdf'} format - Binary presentation codec selection framework context.
   */
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

        {/* Unified single full width layout workspace view */}
        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 32, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Stream Export Module Panel */}
            <div
              style={{
                backgroundColor: T.white,
                borderRadius: 16,
                padding: '20px',
                boxShadow: '0 4px 8px rgba(14,31,31,0.61)',
                border: `1px solid ${T.mutedCream}60`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>Isolated Data Extraction Streams</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost }}>Exports are compiled directly in-memory and securely bounded by tenant context fields.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={isLoading || isExporting !== null}
                  onClick={() => handleExport('excel')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: `1px solid ${T.mutedCream}`,
                    backgroundColor: T.white,
                    color: T.deepTeal,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <DownloadIcon color="currentColor" />
                  Excel
                </button>
                <button
                  disabled={isLoading || isExporting !== null}
                  onClick={() => handleExport('pdf')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: T.teal,
                    color: T.white,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <DownloadIcon color="currentColor" />
                  PDF
                </button>
              </div>
            </div>

            {/* Content Pipeline Resolver */}
            {isLoading ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 80, textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 8px rgba(14,31,31,0.61)' }}>
                Resolving isolated distributed ledger metrics...
              </div>
            ) : isError || !summary ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 40, textAlign: 'center', color: T.rust, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 8px rgba(14,31,31,0.61)' }}>
                Gateway routing anomaly occurred trying to aggregate requested data frames.
              </div>
            ) : (
              <>
                {/* Scorecards Grid Elements */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ backgroundColor: T.white, borderRadius: 16, padding: 24, boxShadow: '0 4px 8px rgba(14,31,31,0.61)', borderLeft: `5px solid ${T.teal}` }}>
                    <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Aggregate Yield Value</span>
                    <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: T.inkPrimary }}>{fmtZAR(summary.total_revenue_zar)}</h2>
                  </div>
                  <div style={{ backgroundColor: T.white, borderRadius: 16, padding: 24, boxShadow: '0 4px 14px rgba(14,31,31,0.61)', borderLeft: `5px solid ${T.orange}` }}>
                    <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Tracked Volume Inhabitance</span>
                    <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: T.inkPrimary }}>
                      {summary.total_orders_count} <span style={{ fontSize: 14, color: T.inkSecondary, fontWeight: 500 }}>Ledger Lines</span>
                    </h2>
                  </div>
                </div>

                {/* Tabular Distribution Matrix View */}
                <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(14,31,31,0.61)', border: `1px solid ${T.mutedCream}60` }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: T.inkPrimary, borderBottom: `1px solid ${T.panelBg}`, paddingBottom: 12 }}>
                    Commodity Yield Distribution Ledger
                  </h3>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase' }}>Product Resource Target Identity</th>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', textAlign: 'right' }}>Calculated Net Yield</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary?.revenue_by_product ?? {}).map(([product, totalAmount]) => (
                        <tr key={product} style={{ borderBottom: `1px solid ${T.panelBg}40` }}>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 600, color: T.inkSecondary }}>{product}</td>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 700, color: T.inkPrimary, textAlign: 'right' }}>{fmtZAR(totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Operational Data Charts Sub-Section */}
                  <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'stretch' }}>

                    {/* Share Configuration Matrix Chart */}
                    <div style={{ backgroundColor: T.panelBg, borderRadius: 16, border: `1px solid ${T.mutedCream}60`, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.inkPrimary }}>Revenue Share (Pie)</h4>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>{productEntries.length} products</span>
                      </div>
                      <div style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Tooltip
                              formatter={(value: any, name: any) => [fmtZAR(Number(value)), String(name)]}
                              labelFormatter={(label: any) => `product: ${String(label)}`}
                              contentStyle={{ background: T.white, border: `1px solid ${T.mutedCream}`, borderRadius: 10, boxShadow: '0 4px 14px rgba(14,31,31,0.15)' }}
                            />
                            <Pie
                              data={productEntries}
                              dataKey="value"
                              nameKey="product"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={2}
                            >
                              {productEntries.map((_, idx) => (
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

                    {/* Sorting Vector Histogram Chart */}
                    <div style={{ backgroundColor: T.panelBg, borderRadius: 16, border: `1px solid ${T.mutedCream}60`, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.inkPrimary }}>Top products (Bar)</h4>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>Sorted</span>
                      </div>
                      <div style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer>
                          <BarChart data={productEntries.slice(0, 8)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={`${T.mutedCream}80`} />
                            <XAxis
                              dataKey="product"
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
                              contentStyle={{ background: T.white, border: `1px solid ${T.mutedCream}`, borderRadius: 10, boxShadow: '0 4px 14px rgba(14,31,31,0.15)' }}
                            />
                            <Legend
                              verticalAlign="top"
                              height={24}
                              formatter={() => <span style={{ color: T.inkSecondary, fontSize: 12, fontWeight: 700 }}>Net yield</span>}
                            />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                              {productEntries.slice(0, 8).map((_, idx) => (
                                <Cell key={`bar-${idx}`} fill={pieColors[idx]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── Summary bar (Custom context tooltip data container) ── */}
                <div style={{
                  background: T.deepTeal,
                  borderRadius: 12,
                  padding: '18px 28px',
                  display: 'flex',
                  gap: 40,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  boxShadow: '0 4px 14px rgba(14,31,31,0.2)'
                }}>
                  {[
                    { label: 'Total Orders',    value: summary.total_orders_count.toLocaleString() },
                    { label: 'Total Revenue',   value: fmtZAR(summary.total_revenue_zar) },
                    { label: 'Fulfilled Lines', value: summary.fulfilled_orders_count.toLocaleString() },
                    { label: 'Active Clients',   value: summary.active_clients_count.toLocaleString() },
                    { label: 'Unique Minerals', value: productEntries.length.toString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{
                        margin: 0,
                        fontSize: 10,
                        fontFamily: "system-ui, sans-serif",
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.55)',
                      }}>
                        {label}
                      </p>
                      <p style={{
                        margin: '3px 0 0',
                        fontSize: 18,
                        fontWeight: 700,
                        color: T.white,
                      }}>
                        {value}
                      </p>
                    </div>
                  ))}

                  <div style={{ marginLeft: 'auto' }}>
                    <p style={{
                      margin: 0,
                      fontSize: 10,
                      fontFamily: "system-ui, sans-serif",
                      color: 'rgba(255,255,255,0.45)',
                      letterSpacing: '0.07em',
                    }}>
                      PERIOD
                    </p>
                  </div>
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
