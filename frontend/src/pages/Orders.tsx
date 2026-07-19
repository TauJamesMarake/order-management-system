import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { get, post, patch } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iOrder, iDashboardSummary, iPaginatedResult, iOrderFilters, OrderStatus, iCreateOrderDTO, iUpdateOrderDTO } from '@/types'
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

// Custom Professional SVG Icons
function FilterIcon({ color }: { color: string }) {

  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
}
function AlertIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.rust} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}
function PlusIcon({ color }: { color: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function EditIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
function CancelOrderIcon({ color }: { color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
}
function CloseIcon({ color }: { color: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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

interface iOrderFormState {
  client_name: string
  mineral_type: string
  quantity_kg: string
  unit_price_zar: string
  notes: string
}
const ORDER_FORM_DEFAULTS: iOrderFormState = {
  client_name: '', mineral_type: '', quantity_kg: '', unit_price_zar: '', notes: '',
}

type OrderModalMode = { kind: 'create' } | { kind: 'edit'; order: iOrder } | null

// Only admins and clerks may create/edit/cancel orders (viewers are read-only) — mirrors requireRole('admin','clerk') server-side.
function canManageOrders(role: string | undefined): boolean {
  return role === 'admin' || role === 'clerk'
}

// Ownership check — the list view (v_orders_with_creator) exposes the creator as `creator_id`,
// while the single-order fetch shape uses `created_by`. Check both defensively.
function isOrderOwner(order: iOrder, userId: string | undefined): boolean {
  if (!userId) return false
  const ownerId = (order as unknown as { creator_id?: string }).creator_id ?? order.created_by
  return ownerId === userId
}

export function OrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const activePage = 'orders'
  const [filters, setFilters] = useState<iFilterState>(FILTER_DEFAULTS)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [modal, setModal] = useState<OrderModalMode>(null)
  const [orderForm, setOrderForm] = useState<iOrderFormState>(ORDER_FORM_DEFAULTS)
  const [formError, setFormError] = useState<string | null>(null)

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

  const { data: ordersPage, isLoading: ordersLoading, isError } = useQuery<iPaginatedResult<iOrder>>({
    queryKey: ['orders', orderParams],
    queryFn: () => get<iPaginatedResult<iOrder>>('/orders', { params: orderParams }),
    enabled: !!user,
  })

  const setFilter = (key: keyof iFilterState, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleTabClick = (statusValue: string) => {
    setFilters((prev) => ({ ...prev, status: statusValue, page: 1 }))
  }

  const totalPages = ordersPage ? Math.ceil(ordersPage.total / ordersPage.limit) : 0
  const invalidateOrderData = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
  }

  const createMutation = useMutation({
    mutationFn: (dto: iCreateOrderDTO) => post<iOrder>('/orders', dto),
    onSuccess: () => { invalidateOrderData(); closeOrderModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: iUpdateOrderDTO }) => patch<iOrder>(`/orders/${id}`, dto),
    onSuccess: () => { invalidateOrderData(); closeOrderModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => patch<iOrder>(`/orders/${id}/cancel`),
    onSuccess: invalidateOrderData,
  })

  function openCreateOrder() {
    setOrderForm(ORDER_FORM_DEFAULTS)
    setFormError(null)
    setModal({ kind: 'create' })
  }

  function openEditOrder(order: iOrder) {
    setOrderForm({
      client_name: order.client_name,
      mineral_type: order.mineral_type,
      quantity_kg: String(order.quantity_kg),
      unit_price_zar: String(order.unit_price_zar),
      notes: order.notes ?? '',
    })
    setFormError(null)
    setModal({ kind: 'edit', order })
  }

  function closeOrderModal() {
    setModal(null)
    setFormError(null)
  }

  function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const quantity_kg = Number(orderForm.quantity_kg)
    const unit_price_zar = Number(orderForm.unit_price_zar)

    if (!Number.isFinite(quantity_kg) || quantity_kg <= 0) {
      setFormError('Quantity must be a positive number.')
      return
    }
    if (!Number.isFinite(unit_price_zar) || unit_price_zar <= 0) {
      setFormError('Unit price must be a positive number.')
      return
    }

    const dto = {
      client_name: orderForm.client_name.trim(),
      mineral_type: orderForm.mineral_type.trim(),
      quantity_kg,
      unit_price_zar,
      notes: orderForm.notes.trim() || undefined,
    }

    if (modal?.kind === 'create') {
      createMutation.mutate(dto)
      return
    }
    if (modal?.kind === 'edit') {
      updateMutation.mutate({ id: modal.order.id, dto })
    }
  }

  const isSubmittingOrder = createMutation.isPending || updateMutation.isPending

  if (!user) return null

  // Extract a list of recent items needing immediate processing to use inside the Calendar Reminder panel window
  const activeReminders = ordersPage?.items?.filter(o => o.status === 'pending' || o.status === 'confirmed').slice(0, 4) || []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <SideBar activePage={activePage} />
      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* CORE FRAME MAIN COLUMN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <TopBar title={activePage} searchValue={filters.search} onSearchChange={(v: string) => setFilter('search', v)} />

        <main style={{ padding: '32px', flex: 1, display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* LEFT CONTAINER FIELD: STATUS TABS, FILTER SUBBAR AND DATA TABLE REGISTERS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, }}>

            {/* Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.mutedCream}80`, paddingBottom: 4, overflowX: 'auto', flex: 1 }}>
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

              {canManageOrders(user.role) && (
                <button
                  onClick={openCreateOrder}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
                    border: 'none', backgroundColor: T.teal, color: T.white,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    marginBottom: 4, whiteSpace: 'nowrap',
                  }}
                >
                  <PlusIcon color={T.white} />
                  New Order
                </button>
              )}
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

            {/* Main Orders Document Register Data Table Ledger View */}
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
                        {['Order Ref ID', 'Client Account', 'Mineral Class', 'Quantity', 'Aggregate Price', 'Workflow State', 'Date Created', ''].map((heading, idx) => (
                          <th key={heading || idx} style={{
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
                            <td style={{ padding: '16px 20px' }}>
                              {(() => {
                                const isLocked = order.status === 'cancelled' || order.status === 'delivered'
                                const canEdit = canManageOrders(user.role) && !isLocked && (user.role === 'admin' || isOrderOwner(order, user.id))
                                if (!canEdit) return null
                                return (
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => openEditOrder(order)}
                                      title="Edit order"
                                      style={{
                                        width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.mutedCream}`,
                                        backgroundColor: T.white, color: T.inkSecondary, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      <EditIcon color="currentColor" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Cancel order ${order.order_number}? This cannot be undone.`)) {
                                          cancelMutation.mutate(order.id)
                                        }
                                      }}
                                      title="Cancel order"
                                      style={{
                                        width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.mutedCream}`,
                                        backgroundColor: T.white, color: T.rust, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      <CancelOrderIcon color="currentColor" />
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
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
                        boxShadow: `0 4px  3px ${reminder.status === 'pending' ? T.orange : T.teal}`,
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

      {/* Create / Edit order modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(14,31,31,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          margin: 500,
        }}>
          <div onClick={closeOrderModal} style={{ position: 'absolute', inset: 0 }} />
          <form
            onSubmit={handleOrderSubmit}
            style={{
              position: 'relative', width: 460, backgroundColor: T.white, borderRadius: 20,
              border: `1px solid ${T.mutedCream}`,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.inkPrimary }}>
                {modal.kind === 'create' ? 'New Order Entry' : `Edit Order ${modal.order.order_number}`}
              </h3>
              <button type="button" onClick={closeOrderModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkGhost, padding: 4 }}>
                <CloseIcon color="currentColor" />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${T.rust}10`, color: T.rust, fontSize: 12, fontWeight: 600 }}>
                {formError}
              </div>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Client Name</span>
              <input
                required
                minLength={2}
                value={orderForm.client_name}
                onChange={(e) => setOrderForm(f => ({ ...f, client_name: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Item Name</span>
              <input
                required
                minLength={2}
                value={orderForm.mineral_type}
                onChange={(e) => setOrderForm(f => ({ ...f, mineral_type: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Quantity (kg)</span>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={orderForm.quantity_kg}
                  onChange={(e) => setOrderForm(f => ({ ...f, quantity_kg: e.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Unit Price (ZAR)</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={orderForm.unit_price_zar}
                  onChange={(e) => setOrderForm(f => ({ ...f, unit_price_zar: e.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSecondary }}>Notes (optional)</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={orderForm.notes}
                onChange={(e) => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.mutedCream}`, fontSize: 13, backgroundColor: T.panelBg, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={closeOrderModal}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${T.mutedCream}`,
                  backgroundColor: T.white, color: T.inkSecondary, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingOrder}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                  backgroundColor: T.teal, color: T.white, fontSize: 13, fontWeight: 700,
                  cursor: isSubmittingOrder ? 'not-allowed' : 'pointer', opacity: isSubmittingOrder ? 0.7 : 1,
                }}
              >
                {isSubmittingOrder ? 'Saving...' : modal.kind === 'create' ? 'Create Order' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div >
  )
}

export default OrdersPage