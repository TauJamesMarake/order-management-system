import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { T } from '@/components/ColorPalette'
import { CalendarWidget } from '@/components/Calendar'

/**
 * @interface iReportSummary
 * @description Represents the structured payload returned by the business-scoped reports endpoint.
 */
interface iReportSummary {
  total_revenue_zar: number
  total_orders_count: number
  fulfilled_orders_count: number
  active_clients_count: number
  revenue_by_mineral: Record<string, number>
}

/**
 * @function fmtZAR
 * @description Formats numeric currency values into the South African Rand (ZAR) standard.
 * @param {number} n - The raw numeric value to be formatted.
 * @returns {string} Formatted currency string.
 */
function fmtZAR(n: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Custom operational SVG Icons for the reporting interface.
 */
function DownloadIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
}

function LockIcon() {
  return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}

/**
 * @component ReportsPage
 * @description Renders secure analytical ledger summaries and export parameters for administrative actors.
 * Enforces rigid multi-tenant role isolation ensuring only business admins gain access.
 */
export function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('reports')
  const [isExporting, setIsExporting] = useState<string | null>(null)

  // Redirect unauthenticated operators immediately to access control gate
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  // Securely request tenant analytics matrix, executing only for verified admins
  const { data: summary, isLoading, isError } = useQuery<iReportSummary>({
    queryKey: ['reports-summary'],
    queryFn: () => get<iReportSummary>('/reports/summary'),
    enabled: !!user && user.role === 'admin',
    staleTime: 60_000,
  })

  if (!user) return null

  // Security Guardrail: Enforce authoritative role boundary (SRS §2.3 / §5.4 restriction)
  if (user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <SideBar activePage={activePage} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar title="Access Restrained" searchValue="" onSearchChange={() => {}} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 480, boxShadow: '0 4px 20px rgba(14,31,31,0.40)', border: `1px solid ${T.mutedCream}` }}>
              <LockIcon />
              <h2 style={{ margin: '16px 0 8px', color: T.rust, fontSize: 20, fontWeight: 700 }}>Administrative Clearance Required</h2>
              <p style={{ margin: 0, color: T.inkSecondary, fontSize: 14, lineHeight: 1.5 }}>
                Your current account scope ({user.role}) possesses insufficient authority parameters to compute business ledger matrices or export analytical distributions.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  /**
   * @function handleExport
   * @description Directs browser window context toward isolated report compiler streams.
   * @param {'excel' | 'pdf'} format Target output generation codec.
   */
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setIsExporting(format)
      // Sourced implicitly via secure state cookies/JWT on the server environment (SRS §5.4)
      window.open(`${import.meta.env.VITE_API_URL || ''}/api/reports/export/${format}`, '_blank')
    } catch (error) {
      console.error(`Export framework fault during ${format} compilation pipeline:`, error)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="Business Analytics" searchValue="" onSearchChange={() => {}} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 32, alignItems: 'start' }}>
          
          {/* Main Analytics Container Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Export Pipeline Trigger Bar */}
            <div style={{
              backgroundColor: T.white, borderRadius: 16, padding: '20px',
              boxShadow: '0 4px 14px rgba(14,31,31,0.40)', border: `1px solid ${T.mutedCream}60`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>Data Export Streams</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost }}>In-memory cryptographic stream compilation scoped to tenant prefix.</p>
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
                  Compile Excel Document
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
                  Generate PDF Ledger
                </button>
              </div>
            </div>

            {/* Metrics Grid Matrix */}
            {isLoading ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 80, textAlign: 'center', color: T.inkGhost, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(14,31,31,0.40)' }}>
                Parsing cryptographic tenant tracking pipelines...
              </div>
            ) : isError || !summary ? (
              <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 40, textAlign: 'center', color: T.rust, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(14,31,31,0.40)' }}>
                System execution failure compiling distribution reports. Verify gateway parameters.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ backgroundColor: T.white, borderRadius: 16, padding: 24, boxShadow: '0 4px 14px rgba(14,31,31,0.40)', borderLeft: `5px solid ${T.teal}` }}>
                    <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Aggregate Yield Valuation</span>
                    <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: T.inkPrimary }}>{fmtZAR(summary.total_revenue_zar)}</h2>
                  </div>
                  <div style={{ backgroundColor: T.white, borderRadius: 16, padding: 24, boxShadow: '0 4px 14px rgba(14,31,31,0.40)', borderLeft: `5px solid ${T.orange}` }}>
                    <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Tracked Pipeline Volume</span>
                    <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: T.inkPrimary }}>{summary.total_orders_count} <span style={{ fontSize: 14, color: T.inkSecondary, fontWeight: 500 }}>Entries</span></h2>
                  </div>
                </div>

                {/* Sub-distribution breakdowns */}
                <div style={{ backgroundColor: T.white, borderRadius: 20, padding: 24, boxShadow: '0 4px 20px rgba(14,31,31,0.40)', border: `1px solid ${T.mutedCream}60` }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: T.inkPrimary, borderBottom: `1px solid ${T.panelBg}`, paddingBottom: 12 }}>Commodity Class Distribution Yield</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase' }}>Mineral Identity Classification</th>
                        <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: 'uppercase', textAlign: 'right' }}>Calculated Value Yield</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.revenue_by_mineral).map(([mineral, amount]) => (
                        <tr key={mineral} style={{ borderBottom: `1px solid ${T.panelBg}40` }}>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 600, color: T.inkSecondary }}>{mineral}</td>
                          <td style={{ padding: '14px 8px', fontSize: 13, fontWeight: 700, color: T.inkPrimary, textAlign: 'right' }}>{fmtZAR(amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Right Layout Context Sidebar Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <CalendarWidget />
          </div>

        </main>
      </div>
    </div>
  )
}

export default Reports