import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iUser, iOrder, iPaginatedResult, iOrderFilters, OrderStatus } from '@/types'
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

interface iCustomerWithOrders {
  customer: iUser
  orders: iOrder[]
  totalValueZar: number
}

export function Customers() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activePage] = useState('customers')
  const [searchValue, setSearchValue] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  // Only viewers are customers
  const { data: customers, isLoading: customersLoading, isError } = useQuery<iUser[]>({
    queryKey: ['customers'],
    queryFn: () => get<iUser[]>('/users', { params: { role: 'viewer' } }),
    enabled: !!user && (user.role === 'admin' || user.role === 'clerk'),
  })

  const { data: ordersPage } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['customers-orders'],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { limit: 200 } as iOrderFilters }),
    enabled: !!user && (user.role === 'admin' || user.role === 'clerk'),
  })

  // Build list of customers with their associated orders by matching client_name
  const customersWithOrders: iCustomerWithOrders[] = useMemo(() => {
    const allOrders = ordersPage?.items ?? []
    const list = customers ?? []
    return list.map((customer) => {
      const orders = allOrders.filter((o) =>
        o.client_name.trim().toLowerCase() === customer.full_name.trim().toLowerCase()
      )
      const totalValueZar = orders.reduce((sum, o) => sum + Number(o.total_zar), 0)
      return { customer, orders, totalValueZar }
    })
  }, [customers, ordersPage])

  const filtered = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    return customersWithOrders.filter(
      (c) =>
        !term ||
        c.customer.full_name.toLowerCase().includes(term) ||
        c.customer.email.toLowerCase().includes(term) ||
        c.orders.some((o) => o.order_number.toLowerCase().includes(term))
    )
  }, [customersWithOrders, searchValue])

  const selected = selectedCustomerId
    ? filtered.find((c) => c.customer.id === selectedCustomerId) ?? null
    : null

  if (!user) return null

  const totalCustomers = customersWithOrders.length
  const totalOrderCount = customersWithOrders.reduce((s, c) => s + c.orders.length, 0)
  const totalValueAll = customersWithOrders.reduce((s, c) => s + c.totalValueZar, 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <SideBar activePage={activePage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="customers" searchValue={searchValue} onSearchChange={setSearchValue} />

        <main style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Summary stat cards */}
          <div style={{
            backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`,
            display: 'flex', overflow: 'hidden',
          }}>
            {[
              { label: 'Total Customers', value: customersLoading ? '—' : totalCustomers },
              { label: 'Associated Orders', value: customersLoading ? '—' : totalOrderCount },
              { label: 'Customer Portfolio Value', value: customersLoading ? '—' : fmtZAR(totalValueAll) },
            ].map((stat, idx, arr) => (
              <div key={stat.label} style={{
                flex: 1, padding: '22px 28px',
                borderRight: idx < arr.length - 1 ? `1px solid ${T.mutedCream}` : 'none',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <span style={{ fontSize: 12, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{stat.label}</span>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.inkPrimary }}>{stat.value}</h2>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>

            {/* Customer list */}
            <div style={{
              backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`, overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.mutedCream}60`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Customer Register</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkGhost, backgroundColor: T.panelBg, padding: '4px 10px', borderRadius: 20 }}>{filtered.length} shown</span>
              </div>

              <div>
                {customersLoading ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>Loading customer registry...</div>
                ) : isError ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: T.rust, fontSize: 13, fontWeight: 500 }}>Failed to load customer registry.</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 12, fontWeight: 500 }}>
                    No customers match current search.
                  </div>
                ) : (
                  filtered.map(({ customer, orders, totalValueZar }) => {
                    const activeCustomer = selectedCustomerId === customer.id
                    return (
                      <button
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(activeCustomer ? null : customer.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '14px 20px', border: 'none', borderBottom: `1px solid ${T.panelBg}`,
                          backgroundColor: activeCustomer ? `${T.teal}12` : 'transparent',
                          cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: activeCustomer ? T.teal : T.mutedCream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: activeCustomer ? T.white : T.inkSecondary }}>{customer.full_name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.inkPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.full_name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: T.inkGhost, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.email}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.deepTeal }}>{fmtZAR(totalValueZar)}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: T.inkGhost, fontWeight: 500 }}>{orders.length} orders</p>
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
                {selected ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>{selected.customer.full_name}</span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost, fontWeight: 500 }}>Associated order ledger — {selected.orders.length} record(s)</p>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: T.deepTeal }}>{fmtZAR(selected.totalValueZar)}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Associated Order Ledger</span>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                {!selected ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                    Select a customer from the register to view their associated orders.
                  </div>
                ) : selected.orders.length === 0 ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                    This customer has no associated order records.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: T.panelBg, borderBottom: `1px solid ${T.mutedCream}` }}>
                        {['Order Ref', 'Commodity', 'Quantity', 'Value', 'Status', 'Date'].map((heading, idx) => (
                          <th key={heading} style={{
                            padding: '14px 16px', fontSize: 11, fontWeight: 700, color: T.inkSecondary,
                            textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: idx === 2 || idx === 3 ? 'right' : 'left',
                          }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.orders.map((order) => (
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
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}

export default Customers

