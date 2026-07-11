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

interface iReportSummary {
  total_revenue_zar: number
  total_orders_count: number
  fulfilled_orders_count: number
  active_clients_count: number
  revenue_by_mineral: Record<string, number>
}

function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
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

export function Reports() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('reports')
  const [isExporting, setIsExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const { data: summary, isLoading, isError } = useQuery<iReportSummary>({
    retry: 0,
    queryKey: ['reports-summary'],
    queryFn: () => get<iReportSummary>('/reports/summary'),
    enabled: !!user && user.role === 'admin',
    staleTime: 60_000,
  })

  const mineralEntries = useMemo(() => {
    return Object.entries(summary?.revenue_by_mineral ?? {})
      .map(([mineral, total]) => ({ mineral, value: total }))
      .sort((a, b) => b.value - a.value)
  }, [summary?.revenue_by_mineral])

  const pieColors = useMemo(() => {
    // Keep within existing palette.
    const palette = [T.teal, T.orange, T.deepTeal, T.success, T.rust, T.inkSecondary]
    const out: string[] = []
    for (let i = 0; i < mineralEntries.length; i++) out.push(palette[i % palette.length])
    return out
  }, [mineralEntries.length])

  if (!user) return null
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
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* GLOBAL APPARATUS LEFT NAVIGATION COMPONENT */}
      <SideBar activePage={activePage} />

      {/* RECONCILED MAIN FRAME SPLIT LAYER GRID */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* TOP LEVEL NAVIGATION INTERFACE ANCHOR */}
        <TopBar title="reports" searchValue="" onSearchChange={() => { }} />

        {/* WORKSPACE FRAME LAYOUT SPECIFICATION MATCHING ORDERS SYSTEM GRID */}
        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* PRIMARY GRAPH TRACKER AND REGISTER LEDGER BLOCK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* IN-MEMORY BUFFER PIPELINE EXPORT HUB */}
            <div style={{
              backgroundColor: T.white, borderRadius: 16, padding: '20px',
              boxShadow: '0 4px 8px rgba(14,31,31,0.61)', border: `1px solid ${T.mutedCream}60`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>Isolated Data Extraction Streams</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost }}>Exports are compiled directly in-memory and securely bounded by tenant context fields.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={isLoading || isExporting !== null}
                  onClick={() => handleExport('excel')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8,
                    border: `1px solid ${T.mutedCream}`, backgroundColor: T.white, color: T.deepTeal,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
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
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  <DownloadIcon color="currentColor" />
                  PDF
                </button>
              </div>
            </div>

            {/* LIVE COMPUTATION DATA LEDGER LAYERS */}
            {isLoading ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 80, textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 8px rgba(14,31,31,0.61)' }}>
                Resolving isolated distributed ledger metrics...
              </div>
            ) : isError || !summary ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 40, textAlign: 'center', color: T.mutedCream, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 8px rgba(14,31,31,0.61)' }}>
                Gateway routing anomaly occurred trying to aggregate requested data frames.
              </div>
            ) : (
              <>
                {/* KPI Value Card Panels */}
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

                {/* Main Tabular Matrix Yield Breakdown */}
                <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(14,31,31,0.61)', border: `1px solid ${T.mutedCream}60` }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: T.inkPrimary, borderBottom: `1px solid ${T.panelBg}`, paddingBottom: 12 }}>
                    Commodity Yield Distribution Ledger
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase' }}>Mineral Resource Target Identity</th>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', textAlign: 'right' }}>Calculated Net Yield</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary?.revenue_by_mineral ?? {}).map(([mineral, totalAmount]) => (
                        <tr key={mineral} style={{ borderBottom: `1px solid ${T.panelBg}40` }}>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 600, color: T.inkSecondary }}>{mineral}</td>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 700, color: T.inkPrimary, textAlign: 'right' }}>{fmtZAR(totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* SECONDARY SIDEBAR CONTEXT LAYOUT GRID ROW PANEL ALIGNMENT */}
          {/* <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <CalendarWidget />
          </div> */}

        </main>
      </div>
    </div>
  )
}

export default Reports