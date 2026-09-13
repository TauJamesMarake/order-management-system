import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
function fmtDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-ZA', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

/**
 * @component MyOrders
 * @description The viewer role's entire experience — a read-only view of the
 * orders placed under their name, with a detail panel. Viewers have no
 * concept of "all orders", "customers", "reports", or "users" — this page
 * is the whole product for them.
 *
 * Matching orders to the signed-in viewer is done by comparing
 * order.client_name to user.full_name (case-insensitive), because orders
 * have no customer_id foreign key back to users.id — same approach
 * Customers.tsx uses for the staff-facing view of the same relationship.
 * This is a real limitation: a typo, a case mismatch, or two customers
 * sharing a name will misattribute or hide orders. Worth fixing properly
 * with a customer_id column when there's room for a migration.
 */
export function MyOrders() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [activePage] = useState('my-orders')
    const [searchValue, setSearchValue] = useState('')
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

    useEffect(() => {
        if (!user) navigate('/login', { replace: true })
    }, [user, navigate])

    const { data: ordersPage, isLoading, isError } = useQuery<iPaginatedResult<iOrder>>({
        queryKey: ['my-orders'],
        queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: { limit: 200 } as iOrderFilters }),
        enabled: !!user,
    })

    const myOrders = useMemo(() => {
        if (!user) return []
        const mine = (ordersPage?.items ?? []).filter(
            (o) => o.client_name.trim().toLowerCase() === user.full_name.trim().toLowerCase()
        )
        const term = searchValue.trim().toLowerCase()
        return mine
            .filter((o) => !term || o.order_number.toLowerCase().includes(term) || o.mineral_type.toLowerCase().includes(term))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [ordersPage, user, searchValue])

    const selected = selectedOrderId ? myOrders.find((o) => o.id === selectedOrderId) ?? null : null

    if (!user) return null

    const totalValue = myOrders.reduce((s, o) => s + Number(o.total_zar), 0)
    const activeCount = myOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'dispatched').length

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <SideBar activePage={activePage} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <TopBar title="my orders" searchValue={searchValue} onSearchChange={setSearchValue} />

                <main style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Summary strip */}
                    <div style={{
                        backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`,
                        display: 'flex', overflow: 'hidden',
                    }}>
                        {[
                            { label: 'Total Orders', value: isLoading ? '—' : myOrders.length },
                            { label: 'Active Orders', value: isLoading ? '—' : activeCount },
                            { label: 'Lifetime Value', value: isLoading ? '—' : fmtZAR(totalValue) },
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24, alignItems: 'start' }}>

                        {/* Order list */}
                        <div style={{
                            backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`, overflow: 'hidden',
                        }}>
                            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.mutedCream}60`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Your Orders</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkGhost, backgroundColor: T.panelBg, padding: '4px 10px', borderRadius: 20 }}>{myOrders.length} shown</span>
                            </div>

                            <div>
                                {isLoading ? (
                                    <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>Loading your orders...</div>
                                ) : isError ? (
                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: T.rust, fontSize: 13, fontWeight: 500 }}>Failed to retrieve your orders.</div>
                                ) : myOrders.length === 0 ? (
                                    <div style={{ padding: '60px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 12, fontWeight: 500 }}>
                                        {searchValue.trim() ? 'No orders match your search.' : "No orders found under your name yet."}
                                    </div>
                                ) : (
                                    myOrders.map((order) => {
                                        const active = selectedOrderId === order.id
                                        return (
                                            <button
                                                key={order.id}
                                                onClick={() => setSelectedOrderId(active ? null : order.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                                                    padding: '14px 20px', border: 'none', borderBottom: `1px solid ${T.panelBg}`,
                                                    backgroundColor: active ? `${T.teal}12` : 'transparent',
                                                    cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s ease',
                                                }}
                                            >
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.deepTeal }}>{order.order_number}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: T.inkSecondary }}>{order.mineral_type} — {Number(order.quantity_kg).toLocaleString('en-ZA')} kg</p>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: T.inkPrimary }}>{fmtZAR(Number(order.total_zar))}</span>
                                                    <StatusPill status={order.status} />
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Order detail panel */}
                        <div style={{
                            backgroundColor: T.white, borderRadius: 20, border: `1px solid ${T.mutedCream}60`, overflow: 'hidden',
                        }}>
                            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.mutedCream}60` }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkPrimary }}>Order Details</span>
                            </div>

                            {!selected ? (
                                <div style={{ padding: '80px 20px', textAlign: 'center', color: T.inkGhost, fontSize: 13, fontWeight: 500 }}>
                                    Select an order from the list to view its details.
                                </div>
                            ) : (
                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.deepTeal }}>{selected.order_number}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkGhost }}>Placed {fmtDate(selected.created_at)}</p>
                                        </div>
                                        <StatusPill status={selected.status} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '16px 0', borderTop: `1px solid ${T.panelBg}`, borderBottom: `1px solid ${T.panelBg}` }}>
                                        <div>
                                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Commodity</span>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{selected.mineral_type}</p>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Quantity</span>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{Number(selected.quantity_kg).toLocaleString('en-ZA')} kg</p>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Unit Price</span>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: T.inkPrimary }}>{fmtZAR(Number(selected.unit_price_zar))}</p>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Total</span>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color: T.deepTeal }}>{fmtZAR(Number(selected.total_zar))}</p>
                                        </div>
                                    </div>

                                    {selected.notes && (
                                        <div>
                                            <span style={{ fontSize: 11, color: T.inkGhost, fontWeight: 600, textTransform: 'uppercase' }}>Notes</span>
                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.inkSecondary, lineHeight: 1.5 }}>{selected.notes}</p>
                                        </div>
                                    )}

                                    <div style={{ fontSize: 11, color: T.inkGhost }}>
                                        Last updated {fmtDateTime(selected.updated_at)}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </main>
            </div>
        </div>
    )
}

export default MyOrders