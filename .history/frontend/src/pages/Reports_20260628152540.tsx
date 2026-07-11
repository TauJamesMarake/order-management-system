import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Order, iDashboardSummary } from '@/types'
import { T } from '@/components/ColorPalette'
import { TopBar } from '@/components/TopBar'
import { SideBar } from '@/components/SideBar'
import {
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts'
import { get } from '@/lib/http'

// ─── Types ────────────────────────────────────────────────────

interface iReportSummary {
    total_orders: number
    total_value_zar: number
    total_qty_kg: number
    by_status: Record<string, number>
    by_mineral: Record<string, { count: number; value: number }>
}

interface iPaginatedOrders {
    items: Order[]
    total: number
    page: number
    limit: number
    totalPages: number
}

// ─── Constants ────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#B45309', bg: '#FEF3C7' },
    confirmed: { label: 'Confirmed', color: '#1D4ED8', bg: '#DBEAFE' },
    dispatched: { label: 'Dispatched', color: '#0E7490', bg: '#CFFAFE' },
    delivered: { label: 'Delivered', color: '#15803D', bg: '#DCFCE7' },
    cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEE2E2' },
}

const MINERAL_PALETTE = [
    '#2E75B6', '#1E3A5F', '#C9A84C', '#1A6B6B',
    '#6B7280', '#7C3AED', '#DC2626', '#059669',
]

// ─── Helpers

function formatZAR(n: number): string {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        maximumFractionDigits: 0,
    }).format(n)
}

function formatZARCompact(n: number): string {
    if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `R${(n / 1_000).toFixed(1)}K`
    return formatZAR(n)
}

function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function buildTrendData(orders: Order[], days = 30) {
    const now = new Date()
    const result: { date: string; revenue: number; count: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)

        const next = new Date(d)
        next.setDate(next.getDate() + 1)

        const dayOrders = orders.filter(o => {
            const t = new Date(o.created_at).getTime()
            return t >= d.getTime() && t < next.getTime()
        })

        result.push({
            date: shortDate(d.toISOString()),
            revenue: dayOrders.reduce((s, o) => s + Number(o.total_zar), 0),
            count: dayOrders.length,
        })
    }

    return result
}

// ─── Sub-components ───────────────────────────────────────────

interface iKpiCardProps {
    label: string
    value: string | number
    sub?: string
    accent?: string
    loading?: boolean
}

function KpiCard({ label, value, sub, accent = T.teal, loading }: iKpiCardProps) {
    return (
        <div style={{
            background: T.white,
            border: `1px solid ${T.mutedCream}`,
            borderRadius: 12,
            padding: '20px 24px',
            flex: 1,
            minWidth: 180,
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: 4, height: '100%',
                background: accent,
                borderRadius: '12px 0 0 12px',
            }} />

            <p style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: T.teal,
                fontFamily: "'DM Mono', monospace",
            }}>
                {label}
            </p>

            {loading ? (
                <div style={{
                    marginTop: 8,
                    height: 32,
                    width: '60%',
                    borderRadius: 6,
                    background: '#E2E8F0',
                    animation: 'pulse 1.5s ease-in-out infinite',
                }} />
            ) : (
                <p style={{
                    margin: '6px 0 0',
                    fontSize: 28,
                    fontWeight: 700,
                    color: T.teal,
                    fontFamily: "'Playfair Display', serif",
                    lineHeight: 1.1,
                }}>
                    {value}
                </p>
            )}

            {sub && !loading && (
                <p style={{
                    margin: '4px 0 0',
                    fontSize: 12,
                    color: T.teal,
                    fontFamily: "'Lato', sans-serif",
                }}>
                    {sub}
                </p>
            )}
        </div>
    )
}

function StatusPill({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? { label: status, color: '#4A5568', bg: '#F3F4F6' }
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.04em',
            color: meta.color,
            background: meta.bg,
        }}>
            {meta.label}
        </span>
    )
}

interface iSectionProps {
    title: string
    children: React.ReactNode
    action?: React.ReactNode
}

function Section({ title, children, action }: iSectionProps) {
    return (
        <div style={{
            background: T.white,
            border: `1px solid ${T.mutedCream}`,
            borderRadius: 12,
            overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: `1px solid ${T.mutedCream}`,
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.teal,
                    fontFamily: "'Playfair Display', serif",
                    letterSpacing: '0.01em',
                }}>
                    {title}
                </h3>
                {action}
            </div>
            <div style={{ padding: '20px 24px' }}>
                {children}
            </div>
        </div>
    )
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
    return (
        <div style={{
            height,
            background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
            borderRadius: 8,
            animation: 'shimmer 1.5s infinite',
        }} />
    )
}

// ─────────────────────────────────────────────────────────────
// CustomTooltip
//
// IMPORTANT: this must be a plain function that returns JSX —
// NOT an arrow function defined inline inside JSX props.
//
// Defining it inline as a prop value means React sees a new
// function object on every render, which breaks Recharts'
// internal memoisation and can trigger the hooks-order error.
// Defining it here as a named component fixes this.
// ─────────────────────────────────────────────────────────────
interface iTooltipPayloadItem {
    dataKey?: string
    name?: string
    value?: unknown
    color?: string
}

interface iCustomTooltipProps {
    active?: boolean
    payload?: iTooltipPayloadItem[]
    label?: string
}

function CustomTooltip({ active, payload, label }: iCustomTooltipProps) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: T.white,
            border: `1px solid ${T.mutedCream}`,
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
        }}>
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: T.teal }}>{label}</p>
            {payload.map((p) => (
                <p key={String(p.dataKey)} style={{ margin: '2px 0', color: p.color }}>
                    {p.name}:{' '}
                    <strong>
                        {p.dataKey === 'revenue'
                            ? formatZAR(Number(p.value))
                            : String(p.value)}
                    </strong>
                </p>
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// DonutTooltip — separate named component for the pie chart
// Same reason: must not be defined inline in JSX props.
// ─────────────────────────────────────────────────────────────
interface iDonutTooltipProps {
    active?: boolean
    payload?: Array<{ name?: string; value?: unknown }>
}

function DonutTooltip({ active, payload }: iDonutTooltipProps) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
        <div style={{
            background: T.white,
            border: `1px solid ${T.mutedCream}`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
        }}>
            <strong style={{ color: T.teal }}>{d.name}</strong>
            <span style={{ marginLeft: 8, color: T.teal }}>{String(d.value)} orders</span>
        </div>
    )
}

const RANGES = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
]

// ─── Main Component ───────────────────────────────────────────

export function Reports() {
    const [rangeDays, setRangeDays] = useState(30)
    const [activePage] = useState('reports')

    const dateFrom = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - rangeDays)
        return d.toISOString().slice(0, 10)
    }, [rangeDays])

    const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), [])

    // Query 1: Dashboard summary (live KPI strip — not date filtered)
    const { data: dashData, isLoading: dashLoading } = useQuery<iDashboardSummary>({
        queryKey: ['dashboard-summary'],
        queryFn: () => get<iDashboardSummary>('/orders/summary'),
        staleTime: 60_000,
    })

    // Query 2: Report summary (aggregated totals, filtered by date range)
    const { data: reportData, isLoading: reportLoading } = useQuery<iReportSummary>({
        queryKey: ['report-summary', dateFrom, dateTo],
        queryFn: () =>
            get<iReportSummary>('/reports/summary', {
                params: { date_from: dateFrom, date_to: dateTo },
            }),
        staleTime: 60_000,
    })

    // Query 3: Raw orders for trend chart (up to 500 in the window)
    const { data: ordersData, isLoading: ordersLoading } = useQuery<iPaginatedOrders>({
        queryKey: ['analytics-orders', dateFrom, dateTo],
        queryFn: () =>
            get<iPaginatedOrders>('/orders', {
                params: { date_from: dateFrom, date_to: dateTo, limit: 500, page: 1 },
            }),
        staleTime: 60_000,
    })

    // ── Derived data ──────────────────────────────────────────

    const trendData = useMemo(
        () => buildTrendData(ordersData?.items ?? [], rangeDays),
        [ordersData, rangeDays],
    )

    const statusDonutData = useMemo(() => {
        const src = reportData?.by_status ?? {}
        return Object.entries(src)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => ({
                name: STATUS_META[k]?.label ?? k,
                value: v,
                color: STATUS_META[k]?.color ?? '#4A5568',
            }))
    }, [reportData])

    const mineralBarData = useMemo(() => {
        const src = reportData?.by_mineral ?? {}
        return Object.entries(src)
            .sort((a, b) => b[1].value - a[1].value)
            .slice(0, 8)
            .map(([mineral, stats]) => ({
                mineral: mineral.length > 18 ? `${mineral.slice(0, 16)}…` : mineral,
                value: stats.value,
                count: stats.count,
            }))
    }, [reportData])

    const recentOrders = useMemo(
        () =>
            [...(ordersData?.items ?? [])]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 10),
        [ordersData],
    )

    const peakRevenue = useMemo(
        () => Math.max(...trendData.map(d => d.revenue), 0),
        [trendData],
    )

    // ── KPI values ────────────────────────────────────────────

    const totalActiveValue = dashData?.total_value_active_zar ?? 0
    const totalToday = dashData?.total_today ?? 0
    const pendingCount = dashData?.by_status?.pending ?? 0
    const totalOrdersInRange = reportData?.total_orders ?? 0
    const totalValueInRange = reportData?.total_value_zar ?? 0

    return (
        <>


            <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: T.mutedCream, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {/* SIDEBAR COMPONENT */}
                <SideBar activePage={activePage} />

                {/* MAIN CONTENT VIEWPORT */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                    {/* TOP PANEL CONTROL BAR */}
                    <TopBar title={activePage} searchValue={''} onSearchChange={function (v: string): void {
                        throw new Error('Function not implemented.')
                    }} />

                    {/* ── Page header ────────────────────────────────── */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '28px 32px 0',
                    }}>
                        <div>

                        <h1 style={{

                            margin: 0,
                            fontSize: 24,
                            fontWeight: 700,
                            color: T.teal,
                            fontFamily: "'Playfair Display', serif",
                        }}>
                            Analytics
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.teal }}>
                            Order performance overview for Ntsoaki Distributions
                        </p>
                    </div>

                    {/* Date range toggle */}
                    <div style={{
                        display: 'flex',
                        gap: 2,
                        background: T.white,
                        border: `1px solid ${T.mutedCream}`,
                        borderRadius: 8,
                        padding: 3,
                    }}>
                        {RANGES.map(r => (
                            <button
                                key={r.days}
                                onClick={() => setRangeDays(r.days)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    fontFamily: "'DM Mono', monospace",
                                    transition: 'all 0.15s ease',
                                    background: rangeDays === r.days ? T.teal : 'transparent',
                                    color: rangeDays === r.days ? T.white : T.teal,
                                }}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    </div>
                    </div>

                    {/* ── Main content ───────────────────────────────── */}

                <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* KPI Strip */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <KpiCard
                            label="Orders Today"
                            value={totalToday}
                            sub="Created since midnight"
                            accent={T.teal}
                            loading={dashLoading}
                        />
                        <KpiCard
                            label="Active Pipeline"
                            value={formatZARCompact(totalActiveValue)}
                            sub="Pending + confirmed + dispatched"
                            accent={T.rust}
                            loading={dashLoading}
                        />
                        <KpiCard
                            label={`Revenue (${rangeDays}d)`}
                            value={formatZARCompact(totalValueInRange)}
                            sub={`${totalOrdersInRange} orders in period`}
                            accent={T.teal}
                            loading={reportLoading}
                        />
                        <KpiCard
                            label="Awaiting Dispatch"
                            value={pendingCount}
                            sub="Orders in pending state"
                            accent="#B45309"
                            loading={dashLoading}
                        />
                    </div>

                    {/* Row 2: Trend + Donut */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

                        <Section
                            title={`Revenue Trend — Last ${rangeDays} Days`}
                            action={
                                <span style={{
                                    fontSize: 11,
                                    color: T.teal,
                                    fontFamily: "'DM Mono', monospace",
                                }}>
                                    Peak: {formatZARCompact(peakRevenue)}
                                </span>
                            }
                        >
                            {ordersLoading ? (
                                <ChartSkeleton height={220} />
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart
                                        data={trendData}
                                        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={T.mutedCream}
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10, fill: T.teal, fontFamily: "'DM Mono', monospace" }}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={rangeDays === 7 ? 0 : rangeDays === 30 ? 4 : 13}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: T.teal, fontFamily: "'DM Mono', monospace" }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v: number) => formatZARCompact(v)}
                                            width={64}
                                        />
                                        {/* Pass the named component — NOT an inline function */}
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="revenue"
                                            name="Revenue"
                                            stroke={T.teal}
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 5, fill: T.teal, strokeWidth: 2, stroke: T.white }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            name="Orders"
                                            stroke={T.rust}
                                            strokeWidth={1.5}
                                            dot={false}
                                            strokeDasharray="4 4"
                                            activeDot={{ r: 4, fill: T.rust }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}

                            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                                {[
                                    { color: T.teal, label: 'Revenue (ZAR)', dash: false },
                                    { color: T.rust, label: 'Order count', dash: true },
                                ].map(({ color, label, dash }) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <svg width={24} height={2}>
                                            <line
                                                x1={0} y1={1} x2={24} y2={1}
                                                stroke={color}
                                                strokeWidth={2}
                                                strokeDasharray={dash ? '4 3' : undefined}
                                            />
                                        </svg>
                                        <span style={{
                                            fontSize: 11,
                                            color: T.teal,
                                            fontFamily: "'DM Mono', monospace",
                                        }}>
                                            {label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <Section title="Orders by Status">
                            {reportLoading ? (
                                <ChartSkeleton height={220} />
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie
                                                data={statusDonutData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={52}
                                                outerRadius={80}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {statusDonutData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            {/* Named component — NOT inline */}
                                            <Tooltip content={<DonutTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {statusDonutData.map(d => {
                                            const total = statusDonutData.reduce((s, x) => s + x.value, 0)
                                            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                                            return (
                                                <div
                                                    key={d.name}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: '50%',
                                                            background: d.color,
                                                            flexShrink: 0,
                                                        }} />
                                                        <span style={{ fontSize: 12, color: T.teal }}>{d.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{
                                                            fontSize: 11,
                                                            fontFamily: "'DM Mono', monospace",
                                                            color: T.teal,
                                                        }}>
                                                            {d.value}
                                                        </span>
                                                        <span style={{
                                                            fontSize: 10,
                                                            fontFamily: "'DM Mono', monospace",
                                                            color: '#9CA3AF',
                                                            minWidth: 30,
                                                            textAlign: 'right',
                                                        }}>
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </Section>
                    </div>

                    {/* Row 3: Minerals + Recent Orders */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        <Section title="Top Minerals by Revenue">
                            {reportLoading ? (
                                <ChartSkeleton height={220} />
                            ) : mineralBarData.length === 0 ? (
                                <div style={{
                                    height: 220,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: T.teal,
                                    fontSize: 13,
                                }}>
                                    No mineral data for this period
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart
                                        layout="vertical"
                                        data={mineralBarData}
                                        margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                                        barCategoryGap="30%"
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={T.mutedCream}
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 10, fill: T.teal, fontFamily: "'DM Mono', monospace" }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v: number) => formatZARCompact(v)}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="mineral"
                                            tick={{ fontSize: 11, fill: T.teal }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={110}
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                                        <Bar dataKey="value" name="Revenue" radius={[0, 4, 4, 0]}>
                                            {mineralBarData.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={MINERAL_PALETTE[i % MINERAL_PALETTE.length]}
                                                    fillOpacity={0.85}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Section>

                        <Section
                            title="Recent Orders"
                            action={
                                <a
                                    href="/orders"
                                    style={{
                                        fontSize: 12,
                                        color: T.teal,
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        fontFamily: "'DM Mono', monospace",
                                    }}
                                >
                                    View all →
                                </a>
                            }
                        >
                            {ordersLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} style={{
                                            height: 36,
                                            borderRadius: 6,
                                            background: '#F1F5F9',
                                            animation: 'pulse 1.5s ease-in-out infinite',
                                            animationDelay: `${i * 0.1}s`,
                                        }} />
                                    ))}
                                </div>
                            ) : recentOrders.length === 0 ? (
                                <div style={{
                                    height: 220,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: T.teal,
                                    fontSize: 13,
                                }}>
                                    No orders in this period
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                {['Order #', 'Client', 'Total', 'Status', 'Date'].map(h => (
                                                    <th key={h} style={{
                                                        padding: '0 8px 10px',
                                                        textAlign: 'left',
                                                        fontWeight: 700,
                                                        fontSize: 10,
                                                        letterSpacing: '0.07em',
                                                        textTransform: 'uppercase',
                                                        color: T.teal,
                                                        fontFamily: "'DM Mono', monospace",
                                                        borderBottom: `1px solid ${T.mutedCream}`,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentOrders.map((o, i) => (
                                                <tr
                                                    key={o.id}
                                                    style={{ background: i % 2 === 0 ? 'transparent' : '#FAFBFC' }}
                                                >
                                                    <td style={{
                                                        padding: '10px 8px',
                                                        fontFamily: "'DM Mono', monospace",
                                                        color: T.teal,
                                                        fontWeight: 600,
                                                        fontSize: 11,
                                                    }}>
                                                        {o.order_number}
                                                    </td>
                                                    <td style={{
                                                        padding: '10px 8px',
                                                        color: T.teal,
                                                        maxWidth: 120,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {o.client_name}
                                                    </td>
                                                    <td style={{
                                                        padding: '10px 8px',
                                                        fontFamily: "'DM Mono', monospace",
                                                        fontWeight: 600,
                                                        color: T.teal,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {formatZARCompact(Number(o.total_zar))}
                                                    </td>
                                                    <td style={{ padding: '10px 8px' }}>
                                                        <StatusPill status={o.status} />
                                                    </td>
                                                    <td style={{
                                                        padding: '10px 8px',
                                                        fontFamily: "'DM Mono', monospace",
                                                        color: T.teal,
                                                        fontSize: 11,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {shortDate(o.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Section>
                    </div>

                    {/* Summary footer bar */}
                    {!reportLoading && reportData && (
                        <div style={{
                            background: T.teal,
                            borderRadius: 12,
                            padding: '18px 28px',
                            display: 'flex',
                            gap: 40,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                        }}>
                            {[
                                { label: 'Total Orders', value: reportData.total_orders.toLocaleString() },
                                { label: 'Total Revenue', value: formatZAR(reportData.total_value_zar) },
                                { label: 'Total Volume', value: `${Number(reportData.total_qty_kg).toLocaleString('en-ZA', { maximumFractionDigits: 0 })} kg` },
                                { label: 'Delivered', value: (reportData.by_status?.delivered ?? 0).toString() },
                                { label: 'Cancelled', value: (reportData.by_status?.cancelled ?? 0).toString() },
                                { label: 'Unique Minerals', value: Object.keys(reportData.by_mineral ?? {}).length.toString() },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p style={{
                                        margin: 0,
                                        fontSize: 10,
                                        fontFamily: "'DM Mono', monospace",
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
                                        fontFamily: "'Playfair Display', serif",
                                    }}>
                                        {value}
                                    </p>
                                </div>
                            ))}

                            <div style={{ marginLeft: 'auto' }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: 10,
                                    fontFamily: "'DM Mono', monospace",
                                    color: 'rgba(255,255,255,0.45)',
                                    letterSpacing: '0.07em',
                                }}>
                                    PERIOD
                                </p>
                                <p style={{
                                    margin: '3px 0 0',
                                    fontSize: 12,
                                    color: T.rust,
                                    fontFamily: "'DM Mono', monospace",
                                    fontWeight: 600,
                                }}>
                                    {shortDate(dateFrom + 'T00:00:00')} → {shortDate(dateTo + 'T00:00:00')}
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </>
    )
}