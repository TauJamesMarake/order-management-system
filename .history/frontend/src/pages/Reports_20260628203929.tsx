/**
 * Reports.tsx
 * ─────────────────────────────────────────────────────────────
 * Analytics & Reporting page for Ntsoaki OMS.
 *
 * Layout mirrors OrdersPage exactly:
 *   Shell (flex row) → SideBar + Main Column (flex col)
 *   Main Column      → TopBar + <main> (scrollable content)
 *
 * Data sources:
 *   GET /orders/summary    → KPI strip (live, unfiltered)
 *   GET /reports/summary   → Aggregated totals by date range
 *   GET /orders            → Raw rows for revenue trend chart
 *
 * Design token source: T from @/components/ColorPalette
 *   - Page bg:        T.mutedCream  (matches shell in every other page)
 *   - Primary text:   T.inkPrimary
 *   - Secondary text: T.inkSecondary
 *   - Ghost text:     T.inkGhost
 *   - Accent primary: T.deepTeal    (CTAs, active states)
 *   - Accent data:    T.teal        (charts, chart axes)
 *   - Danger accent:  T.rust        (cancelled / destructive)
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useMemo }  from 'react'
import { useQuery }           from '@tanstack/react-query'
import type { Order, iDashboardSummary } from '@/types'
import { T }                  from '@/components/ColorPalette'
import { TopBar }             from '@/components/TopBar'
import { SideBar }            from '@/components/SideBar'
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
    total_orders:    number
    total_value_zar: number
    total_qty_kg:    number
    by_status:       Record<string, number>
    by_mineral:      Record<string, { count: number; value: number }>
}

interface iPaginatedOrders {
    items:      Order[]
    total:      number
    page:       number
    limit:      number
    totalPages: number
}

// ─── Constants ────────────────────────────────────────────────

/**
 * Status badge colours.
 * Kept separate from OrdersPage STATUS_CFG intentionally —
 * reports uses simpler pill (no dot) to save horizontal space
 * in the recent-orders table.
 */
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Pending',    color: '#B45309', bg: '#FEF3C7' },
    confirmed:  { label: 'Confirmed',  color: '#1D4ED8', bg: '#DBEAFE' },
    dispatched: { label: 'Dispatched', color: '#0E7490', bg: '#CFFAFE' },
    delivered:  { label: 'Delivered',  color: '#15803D', bg: '#DCFCE7' },
    cancelled:  { label: 'Cancelled',  color: '#B91C1C', bg: '#FEE2E2' },
}

/** Ordered palette for the mineral bar chart cells. */
const MINERAL_PALETTE = [
    '#2E75B6', '#1E3A5F', '#C9A84C', '#1A6B6B',
    '#6B7280', '#7C3AED', '#DC2626', '#059669',
]

/** Date range selector options. */
const RANGES = [
    { label: '7d',  days: 7  },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
]

// ─── Helpers ──────────────────────────────────────────────────

/** Full ZAR currency string: R 1 234 */
function formatZAR(n: number): string {
    return new Intl.NumberFormat('en-ZA', {
        style:                'currency',
        currency:             'ZAR',
        maximumFractionDigits: 0,
    }).format(n)
}

/** Compact ZAR for chart axes and KPI cards: R1.2M / R450K */
function formatZARCompact(n: number): string {
    if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `R${(n / 1_000).toFixed(1)}K`
    return formatZAR(n)
}

/** Short locale date for chart tick labels: "12 Jun" */
function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

/**
 * Buckets a flat order array into daily { date, revenue, count } rows
 * covering the last `days` calendar days.
 * Days with zero orders still appear so the chart x-axis is continuous.
 */
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
            date:    shortDate(d.toISOString()),
            revenue: dayOrders.reduce((s, o) => s + Number(o.total_zar), 0),
            count:   dayOrders.length,
        })
    }

    return result
}

// ─── Sub-components ───────────────────────────────────────────

// KpiCard ─────────────────────────────────────────────────────

interface iKpiCardProps {
    label:    string
    value:    string | number
    sub?:     string
    accent?:  string
    loading?: boolean
}

/**
 * Single headline metric tile.
 * Left edge accent bar encodes the metric category at a glance.
 * Skeleton state prevents layout shift during query load.
 */
function KpiCard({ label, value, sub, accent = T.deepTeal, loading }: iKpiCardProps) {
    return (
        <div style={{
            background:   T.white,
            border:       `1px solid ${T.mutedCream}`,
            borderRadius: 16,
            padding:      '20px 24px',
            flex:         1,
            minWidth:     180,
            position:     'relative',
            overflow:     'hidden',
            boxShadow:    '0 4px 14px rgba(14,31,31,0.06)',
        }}>
            {/* Left edge accent bar — colour = metric category */}
            <div style={{
                position:     'absolute',
                top: 0, left: 0,
                width:        4, height: '100%',
                background:   accent,
                borderRadius: '16px 0 0 16px',
            }} />

            {/* Label — small caps, muted, monospaced */}
            <p style={{
                margin:        0,
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color:         T.inkSecondary,
                fontFamily:    "'DM Mono', monospace",
            }}>
                {label}
            </p>

            {/* Value — large, bold, primary colour */}
            {loading ? (
                <div style={{
                    marginTop:    8,
                    height:       32,
                    width:        '60%',
                    borderRadius: 6,
                    background:   T.panelBg,
                    animation:    'pulse 1.5s ease-in-out infinite',
                }} />
            ) : (
                <p style={{
                    margin:     '8px 0 0',
                    fontSize:   26,
                    fontWeight: 700,
                    color:      T.inkPrimary,
                    fontFamily: "'Playfair Display', serif",
                    lineHeight: 1.1,
                }}>
                    {value}
                </p>
            )}

            {/* Sub-label — ghost, de-emphasised */}
            {sub && !loading && (
                <p style={{
                    margin:     '5px 0 0',
                    fontSize:   12,
                    color:      T.inkGhost,
                    fontFamily: "'Lato', sans-serif",
                }}>
                    {sub}
                </p>
            )}
        </div>
    )
}

// StatusPill ──────────────────────────────────────────────────

/** Compact coloured pill for the recent orders table. */
function StatusPill({ status }: { status: string }) {
    const meta = STATUS_META[status] ?? { label: status, color: T.inkSecondary, bg: T.panelBg }
    return (
        <span style={{
            display:       'inline-block',
            padding:       '3px 10px',
            borderRadius:  20,
            fontSize:      11,
            fontWeight:    600,
            fontFamily:    "'DM Mono', monospace",
            letterSpacing: '0.03em',
            color:         meta.color,
            background:    meta.bg,
        }}>
            {meta.label}
        </span>
    )
}

// Section ─────────────────────────────────────────────────────

interface iSectionProps {
    title:    string
    children: React.ReactNode
    action?:  React.ReactNode
}

/**
 * Card wrapper with a titled header row and optional right-side action slot.
 * Used for every chart and table panel below the KPI strip.
 */
function Section({ title, children, action }: iSectionProps) {
    return (
        <div style={{
            background:   T.white,
            border:       `1px solid ${T.mutedCream}60`,
            borderRadius: 20,
            overflow:     'hidden',
            boxShadow:    '0 4px 20px rgba(14,31,31,0.06)',
        }}>
            {/* Section header row */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '16px 24px',
                borderBottom:   `1px solid ${T.panelBg}`,
            }}>
                <h3 style={{
                    margin:        0,
                    fontSize:      14,
                    fontWeight:    700,
                    color:         T.inkPrimary,
                    fontFamily:    "'Playfair Display', serif",
                    letterSpacing: '0.01em',
                }}>
                    {title}
                </h3>
                {action}
            </div>

            {/* Section body */}
            <div style={{ padding: '20px 24px' }}>
                {children}
            </div>
        </div>
    )
}

// ChartSkeleton ───────────────────────────────────────────────

/** Shimmer placeholder shown while chart data is loading. */
function ChartSkeleton({ height = 220 }: { height?: number }) {
    return (
        <div style={{
            height,
            background:             'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
            backgroundSize:         '200% 100%',
            borderRadius:           8,
            animation:              'shimmer 1.5s infinite',
        }} />
    )
}

// CustomTooltip ───────────────────────────────────────────────
//
// MUST be a named top-level component — never defined inline inside
// a JSX prop.  Inline definitions create a new function reference on
// every parent render, breaking Recharts' internal memoisation and
// causing the "Invalid hook call" error from the duplicate-React bug.

interface iTooltipPayloadItem {
    dataKey?: string
    name?:    string
    value?:   unknown
    color?:   string
}

interface iCustomTooltipProps {
    active?:  boolean
    payload?: iTooltipPayloadItem[]
    label?:   string
}

function CustomTooltip({ active, payload, label }: iCustomTooltipProps) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background:   T.white,
            border:       `1px solid ${T.mutedCream}`,
            borderRadius: 10,
            padding:      '10px 14px',
            boxShadow:    '0 6px 20px rgba(14,31,31,0.12)',
            fontFamily:   "'DM Mono', monospace",
            fontSize:     12,
        }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: T.inkPrimary, fontSize: 12 }}>
                {label}
            </p>
            {payload.map((p) => (
                <p key={String(p.dataKey)} style={{ margin: '3px 0', color: p.color }}>
                    {p.name}:{' '}
                    <strong style={{ color: T.inkPrimary }}>
                        {p.dataKey === 'revenue'
                            ? formatZAR(Number(p.value))
                            : String(p.value)}
                    </strong>
                </p>
            ))}
        </div>
    )
}

// DonutTooltip ────────────────────────────────────────────────
//
// Separate named component for the PieChart — same rule as above.

interface iDonutTooltipProps {
    active?:  boolean
    payload?: Array<{ name?: string; value?: unknown }>
}

function DonutTooltip({ active, payload }: iDonutTooltipProps) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
        <div style={{
            background:   T.white,
            border:       `1px solid ${T.mutedCream}`,
            borderRadius: 10,
            padding:      '8px 14px',
            fontSize:     12,
            fontFamily:   "'DM Mono', monospace",
            boxShadow:    '0 6px 20px rgba(14,31,31,0.12)',
        }}>
            <strong style={{ color: T.inkPrimary }}>{d.name}</strong>
            <span style={{ marginLeft: 8, color: T.inkSecondary }}>{String(d.value)} orders</span>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────

export function Reports() {

    // ── Local state ───────────────────────────────────────────
    const [rangeDays, setRangeDays] = useState(30)

    // ── Date range bounds (memoised — only changes when rangeDays changes) ──

    const dateFrom = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - rangeDays)
        return d.toISOString().slice(0, 10)
    }, [rangeDays])

    const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), [])

    // ── Query 1: Dashboard summary — live KPI strip (no date filter) ──────

    const { data: dashData, isLoading: dashLoading } = useQuery<iDashboardSummary>({
        queryKey: ['dashboard-summary'],
        queryFn:  () => get<iDashboardSummary>('/orders/summary'),
        staleTime: 60_000,
    })

    // ── Query 2: Report summary — aggregated by selected date range ───────

    const { data: reportData, isLoading: reportLoading } = useQuery<iReportSummary>({
        queryKey: ['report-summary', dateFrom, dateTo],
        queryFn:  () =>
            get<iReportSummary>('/reports/summary', {
                params: { date_from: dateFrom, date_to: dateTo },
            }),
        staleTime: 60_000,
    })

    // ── Query 3: Raw orders — for client-side trend bucketing ─────────────
    //    Capped at 500 rows; adequate for 90-day windows at normal volume.

    const { data: ordersData, isLoading: ordersLoading } = useQuery<iPaginatedOrders>({
        queryKey: ['analytics-orders', dateFrom, dateTo],
        queryFn:  () =>
            get<iPaginatedOrders>('/orders', {
                params: { date_from: dateFrom, date_to: dateTo, limit: 500, page: 1 },
            }),
        staleTime: 60_000,
    })

    // ── Derived data ──────────────────────────────────────────

    /** Daily revenue + count series for the line chart. */
    const trendData = useMemo(
        () => buildTrendData(ordersData?.items ?? [], rangeDays),
        [ordersData, rangeDays],
    )

    /** Donut slices — excludes statuses with zero orders. */
    const statusDonutData = useMemo(() => {
        const src = reportData?.by_status ?? {}
        return Object.entries(src)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => ({
                name:  STATUS_META[k]?.label ?? k,
                value: v,
                color: STATUS_META[k]?.color ?? T.inkSecondary,
            }))
    }, [reportData])

    /** Top 8 minerals sorted by total revenue descending. */
    const mineralBarData = useMemo(() => {
        const src = reportData?.by_mineral ?? {}
        return Object.entries(src)
            .sort((a, b) => b[1].value - a[1].value)
            .slice(0, 8)
            .map(([mineral, stats]) => ({
                mineral: mineral.length > 18 ? `${mineral.slice(0, 16)}…` : mineral,
                value:   stats.value,
                count:   stats.count,
            }))
    }, [reportData])

    /** Last 10 orders by created_at descending — for the quick-view table. */
    const recentOrders = useMemo(
        () =>
            [...(ordersData?.items ?? [])]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 10),
        [ordersData],
    )

    /** Highest single-day revenue in the current window — shown in chart header. */
    const peakRevenue = useMemo(
        () => Math.max(...trendData.map(d => d.revenue), 0),
        [trendData],
    )

    // ── KPI values ────────────────────────────────────────────

    const totalActiveValue   = dashData?.total_value_active_zar ?? 0
    const totalToday         = dashData?.total_today            ?? 0
    const pendingCount       = dashData?.by_status?.pending     ?? 0
    const totalOrdersInRange = reportData?.total_orders         ?? 0
    const totalValueInRange  = reportData?.total_value_zar      ?? 0

    // ── Render ────────────────────────────────────────────────

    return (
        <>
            {/* Global keyframe animations — scoped inside this component */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.45; }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position:  200% 0; }
                }
            `}</style>

            {/*
              ── Outer shell ─────────────────────────────────────────────
              Identical pattern to OrdersPage:
                flex row → SideBar takes fixed width, main column takes flex 1
            */}
            <div style={{
                display:         'flex',
                minHeight:       '100vh',
                backgroundColor: T.mutedCream,
                fontFamily:      'system-ui, -apple-system, sans-serif',
            }}>
                {/* ── Left: Navigation sidebar ──────────────────────── */}
                <SideBar activePage="reports" />

                {/*
                  ── Right: Main column ──────────────────────────────────
                  flex col → TopBar (fixed height) + <main> (scrollable)
                */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                    {/* ── Top bar ───────────────────────────────────── */}
                    <TopBar
                        title="reports"
                        searchValue=""
                        onSearchChange={() => { /* search not applicable on reports page */ }}
                    />

                    {/*
                      ── Scrollable content area ──────────────────────────
                      <main> owns all padding — no extra wrapper needed.
                      gap: 24 spaces every section without per-element margins.
                    */}
                    <main style={{
                        padding:        '32px',
                        flex:           1,
                        display:        'flex',
                        flexDirection:  'column',
                        gap:            24,
                        overflowY:      'auto',
                    }}>

                        {/* ── Page header row ───────────────────────── */}
                        <div style={{
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'space-between',
                        }}>
                            {/* Title + subtitle */}
                            <div>
                                <h1 style={{
                                    margin:     0,
                                    fontSize:   22,
                                    fontWeight: 700,
                                    color:      T.inkPrimary,
                                    fontFamily: "'Playfair Display', serif",
                                    lineHeight: 1.2,
                                }}>
                                    Analytics
                                </h1>
                                <p style={{
                                    margin:    '4px 0 0',
                                    fontSize:  13,
                                    color:     T.inkSecondary,
                                    fontFamily: "'Lato', sans-serif",
                                }}>
                                    Order performance overview — Ntsoaki Distributions
                                </p>
                            </div>

                            {/* Date range pill toggle */}
                            <div style={{
                                display:      'flex',
                                gap:          2,
                                background:   T.white,
                                border:       `1px solid ${T.mutedCream}`,
                                borderRadius: 10,
                                padding:      3,
                                boxShadow:    '0 2px 8px rgba(14,31,31,0.06)',
                            }}>
                                {RANGES.map(r => (
                                    <button
                                        key={r.days}
                                        onClick={() => setRangeDays(r.days)}
                                        style={{
                                            padding:      '7px 18px',
                                            borderRadius: 8,
                                            border:       'none',
                                            cursor:       'pointer',
                                            fontSize:     12,
                                            fontWeight:   700,
                                            fontFamily:   "'DM Mono', monospace",
                                            transition:   'all 0.15s ease',
                                            background:   rangeDays === r.days ? T.deepTeal : 'transparent',
                                            color:        rangeDays === r.days ? T.white    : T.inkSecondary,
                                        }}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── KPI strip ─────────────────────────────── */}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <KpiCard
                                label="Orders Today"
                                value={totalToday}
                                sub="Created since midnight"
                                accent={T.deepTeal}
                                loading={dashLoading}
                            />
                            <KpiCard
                                label="Active Pipeline"
                                value={formatZARCompact(totalActiveValue)}
                                sub="Pending + confirmed + dispatched"
                                accent={T.orange}
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
                                accent={T.rust}
                                loading={dashLoading}
                            />
                        </div>

                        {/* ── Row 2: Revenue trend (wide) + Status donut (narrow) ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

                            {/* Revenue trend line chart */}
                            <Section
                                title={`Revenue Trend — Last ${rangeDays} Days`}
                                action={
                                    <span style={{
                                        fontSize:        11,
                                        color:           T.inkGhost,
                                        fontFamily:      "'DM Mono', monospace",
                                        letterSpacing:   '0.05em',
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
                                                stroke={T.panelBg}
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 10, fill: T.inkGhost, fontFamily: "'DM Mono', monospace" }}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={rangeDays === 7 ? 0 : rangeDays === 30 ? 4 : 13}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: T.inkGhost, fontFamily: "'DM Mono', monospace" }}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(v: number) => formatZARCompact(v)}
                                                width={64}
                                            />
                                            {/* Named component ref — prevents hooks violation */}
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="revenue"
                                                name="Revenue"
                                                stroke={T.deepTeal}
                                                strokeWidth={2.5}
                                                dot={false}
                                                activeDot={{ r: 5, fill: T.deepTeal, strokeWidth: 2, stroke: T.white }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                name="Orders"
                                                stroke={T.orange}
                                                strokeWidth={1.5}
                                                dot={false}
                                                strokeDasharray="4 4"
                                                activeDot={{ r: 4, fill: T.orange }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}

                                {/* Chart legend */}
                                <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                                    {[
                                        { color: T.deepTeal, label: 'Revenue (ZAR)', dash: false },
                                        { color: T.orange,   label: 'Order count',   dash: true  },
                                    ].map(({ color, label, dash }) => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <svg width={24} height={2} style={{ overflow: 'visible' }}>
                                                <line
                                                    x1={0} y1={1} x2={24} y2={1}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                    strokeDasharray={dash ? '4 3' : undefined}
                                                />
                                            </svg>
                                            <span style={{
                                                fontSize:   11,
                                                color:      T.inkSecondary,
                                                fontFamily: "'DM Mono', monospace",
                                            }}>
                                                {label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Orders by status — donut */}
                            <Section title="Orders by Status">
                                {reportLoading ? (
                                    <ChartSkeleton height={220} />
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={170}>
                                            <PieChart>
                                                <Pie
                                                    data={statusDonutData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={48}
                                                    outerRadius={74}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {statusDonutData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} stroke="none" />
                                                    ))}
                                                </Pie>
                                                {/* Named component ref — not inline */}
                                                <Tooltip content={<DonutTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        {/* Donut legend with count + percentage */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                                            {statusDonutData.map(d => {
                                                const total = statusDonutData.reduce((s, x) => s + x.value, 0)
                                                const pct   = total > 0 ? Math.round((d.value / total) * 100) : 0
                                                return (
                                                    <div
                                                        key={d.name}
                                                        style={{
                                                            display:        'flex',
                                                            alignItems:     'center',
                                                            justifyContent: 'space-between',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{
                                                                width:        8,
                                                                height:       8,
                                                                borderRadius: '50%',
                                                                background:   d.color,
                                                                flexShrink:   0,
                                                            }} />
                                                            <span style={{
                                                                fontSize:   12,
                                                                color:      T.inkSecondary,
                                                                fontFamily: "'Lato', sans-serif",
                                                            }}>
                                                                {d.name}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span style={{
                                                                fontSize:   11,
                                                                fontFamily: "'DM Mono', monospace",
                                                                color:      T.inkPrimary,
                                                                fontWeight: 600,
                                                            }}>
                                                                {d.value}
                                                            </span>
                                                            <span style={{
                                                                fontSize:   10,
                                                                fontFamily: "'DM Mono', monospace",
                                                                color:      T.inkGhost,
                                                                minWidth:   28,
                                                                textAlign:  'right',
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

                        {/* ── Row 3: Mineral bar + Recent orders ────────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                            {/* Top minerals by revenue — horizontal bar */}
                            <Section title="Top Minerals by Revenue">
                                {reportLoading ? (
                                    <ChartSkeleton height={220} />
                                ) : mineralBarData.length === 0 ? (
                                    <div style={{
                                        height:         220,
                                        display:        'flex',
                                        alignItems:     'center',
                                        justifyContent: 'center',
                                        color:          T.inkGhost,
                                        fontSize:       13,
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
                                                stroke={T.panelBg}
                                                horizontal={false}
                                            />
                                            <XAxis
                                                type="number"
                                                tick={{ fontSize: 10, fill: T.inkGhost, fontFamily: "'DM Mono', monospace" }}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(v: number) => formatZARCompact(v)}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="mineral"
                                                tick={{ fontSize: 11, fill: T.inkSecondary }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={110}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: T.panelBg }} />
                                            <Bar dataKey="value" name="Revenue" radius={[0, 4, 4, 0]}>
                                                {mineralBarData.map((_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={MINERAL_PALETTE[i % MINERAL_PALETTE.length]}
                                                        fillOpacity={0.88}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </Section>

                            {/* Recent orders — quick-view table */}
                            <Section
                                title="Recent Orders"
                                action={
                                    <a
                                        href="/orders"
                                        style={{
                                            fontSize:       12,
                                            color:          T.deepTeal,
                                            textDecoration: 'none',
                                            fontWeight:     700,
                                            fontFamily:     "'DM Mono', monospace",
                                        }}
                                    >
                                        View all →
                                    </a>
                                }
                            >
                                {ordersLoading ? (
                                    /* Row skeletons mirror the table row height */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div key={i} style={{
                                                height:         36,
                                                borderRadius:   6,
                                                background:     T.panelBg,
                                                animation:      'pulse 1.5s ease-in-out infinite',
                                                animationDelay: `${i * 0.1}s`,
                                            }} />
                                        ))}
                                    </div>
                                ) : recentOrders.length === 0 ? (
                                    <div style={{
                                        height:         220,
                                        display:        'flex',
                                        alignItems:     'center',
                                        justifyContent: 'center',
                                        color:          T.inkGhost,
                                        fontSize:       13,
                                    }}>
                                        No orders in this period
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead>
                                                <tr style={{ backgroundColor: T.panelBg }}>
                                                    {['Order #', 'Client', 'Total', 'Status', 'Date'].map(h => (
                                                        <th key={h} style={{
                                                            padding:       '0 12px 10px',
                                                            textAlign:     'left',
                                                            fontWeight:    700,
                                                            fontSize:      10,
                                                            letterSpacing: '0.07em',
                                                            textTransform: 'uppercase',
                                                            color:         T.inkSecondary,
                                                            fontFamily:    "'DM Mono', monospace",
                                                            borderBottom:  `1px solid ${T.mutedCream}`,
                                                            whiteSpace:    'nowrap',
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
                                                        style={{
                                                            borderBottom:    `1px solid ${T.panelBg}`,
                                                            background:      i % 2 === 0 ? 'transparent' : T.panelBg,
                                                            transition:      'background 0.1s ease',
                                                        }}
                                                    >
                                                        {/* Order number — deepTeal matches the OrdersPage table */}
                                                        <td style={{
                                                            padding:    '11px 12px',
                                                            fontFamily: "'DM Mono', monospace",
                                                            color:      T.deepTeal,
                                                            fontWeight: 700,
                                                            fontSize:   11,
                                                        }}>
                                                            {o.order_number}
                                                        </td>
                                                        <td style={{
                                                            padding:      '11px 12px',
                                                            color:        T.inkPrimary,
                                                            fontWeight:   600,
                                                            maxWidth:     120,
                                                            overflow:     'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace:   'nowrap',
                                                        }}>
                                                            {o.client_name}
                                                        </td>
                                                        <td style={{
                                                            padding:    '11px 12px',
                                                            fontFamily: "'DM Mono', monospace",
                                                            fontWeight: 700,
                                                            color:      T.inkPrimary,
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {formatZARCompact(Number(o.total_zar))}
                                                        </td>
                                                        <td style={{ padding: '11px 12px' }}>
                                                            <StatusPill status={o.status} />
                                                        </td>
                                                        <td style={{
                                                            padding:    '11px 12px',
                                                            fontFamily: "'DM Mono', monospace",
                                                            color:      T.inkGhost,
                                                            fontSize:   11,
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

                        {/* ── Summary footer bar ────────────────────────────── */}
                        {/*
                          Only renders once reportData resolves — avoids
                          a blank bar with zero values on first load.
                        */}
                        {!reportLoading && reportData && (
                            <div style={{
                                background:   T.deepTeal,
                                borderRadius: 16,
                                padding:      '20px 32px',
                                display:      'flex',
                                gap:          40,
                                flexWrap:     'wrap',
                                alignItems:   'center',
                                boxShadow:    '0 4px 20px rgba(14,31,31,0.15)',
                            }}>
                                {[
                                    { label: 'Total Orders',    value: reportData.total_orders.toLocaleString() },
                                    { label: 'Total Revenue',   value: formatZAR(reportData.total_value_zar) },
                                    { label: 'Total Volume',    value: `${Number(reportData.total_qty_kg).toLocaleString('en-ZA', { maximumFractionDigits: 0 })} kg` },
                                    { label: 'Delivered',       value: (reportData.by_status?.delivered ?? 0).toString() },
                                    { label: 'Cancelled',       value: (reportData.by_status?.cancelled ?? 0).toString() },
                                    { label: 'Unique Minerals', value: Object.keys(reportData.by_mineral ?? {}).length.toString() },
                                ].map(({ label, value }) => (
                                    <div key={label}>
                                        <p style={{
                                            margin:        0,
                                            fontSize:      10,
                                            fontFamily:    "'DM Mono', monospace",
                                            letterSpacing: '0.09em',
                                            textTransform: 'uppercase',
                                            color:         'rgba(255,255,255,0.5)',
                                        }}>
                                            {label}
                                        </p>
                                        <p style={{
                                            margin:     '4px 0 0',
                                            fontSize:   18,
                                            fontWeight: 700,
                                            color:      T.white,
                                            fontFamily: "'Playfair Display', serif",
                                        }}>
                                            {value}
                                        </p>
                                    </div>
                                ))}

                                {/* Period range — right-aligned */}
                                <div style={{ marginLeft: 'auto' }}>
                                    <p style={{
                                        margin:        0,
                                        fontSize:      10,
                                        fontFamily:    "'DM Mono', monospace",
                                        color:         'rgba(255,255,255,0.4)',
                                        letterSpacing: '0.07em',
                                        textTransform: 'uppercase',
                                    }}>
                                        Period
                                    </p>
                                    <p style={{
                                        margin:     '4px 0 0',
                                        fontSize:   13,
                                        color:      T.cream,
                                        fontFamily: "'DM Mono', monospace",
                                        fontWeight: 700,
                                    }}>
                                        {shortDate(dateFrom + 'T00:00:00')} → {shortDate(dateTo + 'T00:00:00')}
                                    </p>
                                </div>
                            </div>
                        )}

                    </main>
                </div>{/* end main column */}
            </div>{/* end shell */}
        </>
    )
}

export default Reports