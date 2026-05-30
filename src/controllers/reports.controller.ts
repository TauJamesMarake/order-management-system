import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response'
import * as OrdersService  from '../services/orders.service'
import * as ReportsService from '../services/reports.service'
import { OrderFilters, OrderStatus } from '../types'

// ─────────────────────────────────────────────────────────────
// Reports Controller
//
// IMPORTANT — two response patterns here:
//
//   getSummary()  → standard JSON via sendSuccess()
//   exportExcel() → streams a Buffer as a file download
//   exportPdf()   → streams a Buffer as a file download
//
// File streaming skips sendSuccess() entirely.
// Headers tell the browser to treat the response as a download.
// ─────────────────────────────────────────────────────────────

// ── Shared filter parser ─────────────────────────────────────
// Both summary and export endpoints accept the same query params.
function parseReportFilters(query: Request['query']): OrderFilters {
  const validStatuses: OrderStatus[] = [
    'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'
  ]

  const rawStatus = query.status as string | undefined
  const status = rawStatus && validStatuses.includes(rawStatus as OrderStatus)
    ? rawStatus as OrderStatus
    : undefined

  return {
    status,
    mineral_type: query.mineral_type as string | undefined,
    client_name:  query.client_name  as string | undefined,
    date_from:    query.date_from    as string | undefined,
    date_to:      query.date_to      as string | undefined,
    // No pagination for reports — we want ALL matching orders
    limit: 2000,
    page:  1,
  }
}

// ── GET /api/reports/summary ─────────────────────────────────
export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const filters = parseReportFilters(req.query)
    const result  = await OrdersService.getOrders(filters)
    const orders  = result.items

    // Aggregate totals server-side — don't send all rows to the frontend
    const totalValue  = orders.reduce((sum, o) => sum + Number(o.total_zar),    0)
    const totalQty    = orders.reduce((sum, o) => sum + Number(o.quantity_kg), 0)

    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    }, {})

    const byMineral = orders.reduce<Record<string, { count: number; value: number }>>(
      (acc, o) => {
        const key = o.mineral_type
        acc[key] = acc[key] ?? { count: 0, value: 0 }
        acc[key].count++
        acc[key].value += Number(o.total_zar)
        return acc
      }, {}
    )

    sendSuccess(res, {
      total_orders:     orders.length,
      total_value_zar:  totalValue,
      total_qty_kg:     totalQty,
      by_status:        byStatus,
      by_mineral:       byMineral,
      filters_applied:  {
        date_from:    filters.date_from    ?? null,
        date_to:      filters.date_to      ?? null,
        status:       filters.status       ?? null,
        mineral_type: filters.mineral_type ?? null,
      },
    })
  } catch (err) {
    console.error('[getSummary]', err)
    sendError(res, 'Failed to generate summary.')
  }
}

// ── GET /api/reports/export/excel ────────────────────────────
export async function exportExcel(req: Request, res: Response): Promise<void> {
  try {
    const filters = parseReportFilters(req.query)
    const result  = await OrdersService.getOrders(filters)

    if (result.items.length === 0) {
      sendError(res, 'No orders found for the selected filters.', 404)
      return
    }

    const buffer = await ReportsService.buildExcelReport(result.items, {
      date_from: filters.date_from,
      date_to:   filters.date_to,
      status:    filters.status,
    })

    // Build a descriptive filename including the date range
    const datePart = filters.date_from && filters.date_to
      ? `_${filters.date_from}_to_${filters.date_to}`
      : `_${new Date().toISOString().slice(0, 10)}`

    const filename = `oms_orders${datePart}.xlsx`

    // ── File streaming headers ────────────────────────────
    // Content-Type tells the browser what kind of file this is
    // Content-Disposition: attachment forces a download (not inline render)
    // Content-Length lets the browser show a progress bar
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length',      buffer.length)
    res.setHeader('Cache-Control',       'no-cache, no-store, must-revalidate')

    res.status(200).end(buffer)
  } catch (err) {
    console.error('[exportExcel]', err)
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      sendError(res, 'Failed to generate Excel report.')
    }
  }
}

// ── GET /api/reports/export/pdf ──────────────────────────────
export async function exportPdf(req: Request, res: Response): Promise<void> {
  try {
    const filters = parseReportFilters(req.query)
    const result  = await OrdersService.getOrders(filters)

    if (result.items.length === 0) {
      sendError(res, 'No orders found for the selected filters.', 404)
      return
    }

    const buffer = await ReportsService.buildPdfReport(result.items, {
      date_from: filters.date_from,
      date_to:   filters.date_to,
      status:    filters.status,
    })

    const datePart = filters.date_from && filters.date_to
      ? `_${filters.date_from}_to_${filters.date_to}`
      : `_${new Date().toISOString().slice(0, 10)}`

    const filename = `ntsoaki_orders${datePart}.pdf`

    res.setHeader('Content-Type',        'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length',      buffer.length)
    res.setHeader('Cache-Control',       'no-cache, no-store, must-revalidate')

    res.status(200).end(buffer)
  } catch (err) {
    console.error('[exportPdf]', err)
    if (!res.headersSent) {
      sendError(res, 'Failed to generate PDF report.')
    }
  }
}
