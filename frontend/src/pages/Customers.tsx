import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iOrder, iPaginatedResult, iOrderFilters, OrderStatus } from '@/types'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import { T } from '@/components/ColorPalette'

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

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: '#FEF0E8', text: '#9A3B0A', dot: T.orange, label: 'Pending' },
  confirmed: { bg: '#E0F0F0', text: '#0A4A4A', dot: T.teal, label: 'Confirmed' },
  dispatched: { bg: '#E0ECEC', text: '#0C3E3E', dot: T.deepTeal, label: 'Dispatched' },
  delivered: { bg: '#D4ECEC', text: '#0A4A4A', dot: T.success, label: 'Delivered' },
  cancelled: { bg: '#FAE8E5', text: '#6B1A10', dot: T.rust, label: 'Cancelled' },
}

function StatusPill({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CFG[status] ?? { bg: T.panelBg, text: T.inkSecondary, dot: T.inkGhost, label: status }
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

export function Customers() {
  const { user } = useAuthStore()
  const [activePage] = useState('customers')
  const [searchValue, setSearchValue] = useState('')
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null)
  const [ordersPageNumber, setOrdersPageNumber] = useState(1)

  const {
    data: customers,
    isLoading: customersLoading,
    isError: customersError
  } = useQuery<string[]>({
    queryKey: ['customer-accounts'],
    queryFn: () => get<string[]>('/orders/clients'),
    enabled: !!user,
  })

  const filtered = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    return (customers ?? []).filter((clientName) =>
      !term || clientName.toLowerCase().includes(term)
    )
  }, [customers, searchValue])

  const {
    data: ordersPage,
    isLoading: ordersLoading,
    isError: ordersError,
  } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['customers-orders', selectedClientName, ordersPageNumber],
    queryFn: () => {
      if (!selectedClientName) {
        throw new Error('Select a customer account before loading its orders.')
      }
      return get<iPaginatedResult<iOrder>>('/orders', {
        params: {
          client_name_exact: selectedClientName,
          page: ordersPageNumber,
          limit: 20,
        } satisfies iOrderFilters,
      })
    },
    enabled: !!selectedClientName,
  })

  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'Inter, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="customers" searchValue={searchValue} onSearchChange={setSearchValue} />

        <main style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>

            {/* Customer list */}
            <div style={{
              backgroundColor: T.white,
              borderRadius: 20,
              border: `1px solid ${T.mutedCream}60`,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '18px 20px',
                borderBottom: `1px solid ${T.mutedCream}60`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Client Accounts</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkGhost,
                  backgroundColor: T.panelBg, padding: '4px 10px', borderRadius: 20
                  }}>{filtered.length} shown</span>
              </div>

              <div>
                {customersLoading ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>Loading customer registry...</div>
                ) : customersError ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: T.rust, fontSize: 13, fontWeight: 500 }}>Failed to load customer registry.</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 12, fontWeight: 500 }}>
                    No customers match current search.
                  </div>
                ) : (
                  filtered.map((clientName) => {
                    const activeCustomer = selectedClientName === clientName
                    return (
                      <button
                        key={clientName}
                        onClick={() => {
                          setSelectedClientName(activeCustomer ? null : clientName)
                          setOrdersPageNumber(1)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '14px 20px', border: 'none', borderBottom: `1px solid ${T.panelBg}`,
                          backgroundColor: activeCustomer ? `${T.teal}12` : 'transparent',
                          cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: activeCustomer ? T.teal : T.mutedCream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: activeCustomer ? T.white : T.inkSecondary }}>{clientName.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.inkPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientName}</p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Selected customer's orders panel */}
            <div style={{
              backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`, overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.mutedCream}60` }}>
                {selectedClientName ? (
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>{selectedClientName}</span>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>
                      Associated orders{ordersPage ? ` — ${ordersPage.total} record(s)` : ''}
                    </p>
                  </div>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Associated Order Ledger</span>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                {!selectedClientName ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                    Select a customer from the register to view their associated orders.
                  </div>
                ) : ordersLoading ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                    Loading associated orders...
                  </div>
                ) : ordersError ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: T.rust, fontSize: 13, fontWeight: 500 }}>
                    Failed to load associated orders.
                  </div>
                ) : ordersPage?.items.length === 0 ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                    This customer has no associated order records.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: T.panelBg, borderBottom: `1px solid ${T.mutedCream}` }}>
                        {['Order Ref', 'Item Name', 'Quantity', 'Price', 'Status', 'Date'].map((heading, idx) => (
                          <th key={heading} style={{
                            padding: '14px 16px', fontSize: 11, fontWeight: 700, color: T.inkSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: idx === 2 || idx === 3 ? 'right' : 'left',
                          }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordersPage?.items.map((order) => (
                        <tr key={order.id} style={{ borderBottom: `1px solid ${T.panelBg}` }}>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: T.deepTeal }}>{order.order_number}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: T.inkSecondary }}>{order.mineral_type}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, textAlign: 'right', fontWeight: 500, color: T.inkSecondary }}>{Number(order.quantity_kg).toLocaleString('en-ZA')} kg</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: T.inkPrimary }}>{fmtZAR(Number(order.total_zar))}</td>
                          <td style={{ padding: '14px 16px' }}><StatusPill status={order.status} /></td>
                          <td style={{ padding: '14px 16px', fontSize: 12, color: T.inkGhost, whiteSpace: 'nowrap' }}>{fmtDate(order.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {selectedClientName && ordersPage && ordersPage.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${T.mutedCream}` }}>
                  <button
                    type="button"
                    disabled={ordersPageNumber <= 1}
                    onClick={() => setOrdersPageNumber((page) => page - 1)}
                    style={{ padding: '8px 12px', border: `1px solid ${T.mutedCream}`, borderRadius: 8, backgroundColor: T.white, color: T.inkPrimary, cursor: ordersPageNumber <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 12, color: T.inkGhost }}>Page {ordersPage.page} of {ordersPage.totalPages}</span>
                  <button
                    type="button"
                    disabled={ordersPageNumber >= ordersPage.totalPages}
                    onClick={() => setOrdersPageNumber((page) => page + 1)}
                    style={{ padding: '8px 12px', border: `1px solid ${T.mutedCream}`, borderRadius: 8, backgroundColor: T.white, color: T.inkPrimary, cursor: ordersPageNumber >= ordersPage.totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}

export default Customers
