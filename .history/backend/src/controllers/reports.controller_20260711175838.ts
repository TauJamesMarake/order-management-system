import { Request, Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import { supabase } from '../db/supabase'
import * as OrdersService from '../services/orders.service'
import * as ReportsService from '../services/reports.service'
import { iOrderFilters, OrderStatus } from '../types'

const REPORT_ROW_CAP = 500

const VALID_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled',
]

// ISO-8601 date string YYYY-MM-DD
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(v => !isNaN(new Date(v).getTime()), 'Invalid date')

function parseReportFilters(
  query: Request['query']
): { filters: iOrderFilters; error?: string } {
  // Validate status
  const rawStatus = query.status as string | undefined
  const status =
    rawStatus && VALID_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : undefined

  // Validate dates
  if (query.date_from) {
    const result = DateStringSchema.safeParse(query.date_from)
    if (!result.success) {
      return { filters: {}, error: 'date_from must be a valid YYYY-MM-DD date.' }
    }
  }

  if (query.date_to) {
    const result = DateStringSchema.safeParse(query.date_to)
    if (!result.success) {
      return { filters: {}, error: 'date_to must be a valid YYYY-MM-DD date.' }
    }
  }

  return {
    filters: {
      status,
      mineral_type: query.mineral_type as string | undefined,
      client_name: query.client_name as string | undefined,
      date_from: query.date_from as string | undefined,
      date_to: query.date_to as string | undefined,
      limit: REPORT_ROW_CAP,
      page: 1,
    },
  }
}

async function resolveOrderPrefix(businessId: string): Promise<string> {
  const { data } = await supabase
    .from('businesses')
    .select('order_prefix')
    .eq('id', businessId)
    .single()
  return data?.order_prefix?.toLowerCase() ?? 'orders'
}

// GET /api/reports/summary
export async function getSummary(req: Request, res: Response, ssId: string): Promise<void> {
  try {
    const { filters, error: filterError } = parseReportFilters(req.query)
    if (filterError) {
      sendError(res, filterError, 400)
      return
    }

    const result = await OrdersService.getOrders(filters, req.user!.business_id)
    const orders = result.items

    // Aggregate totals server-side, never send all rows to the frontend
    const totalValue = orders.reduce((sum, o) => sum + Number(o.total_zar), 0)
    const totalQty = orders.reduce((sum, o) => sum + Number(o.quantity_kg), 0)

    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    }, {})

    const byMineral = orders.reduce<
      Record<string, { count: number; value: number }>
    >((acc, o) => {
      acc[o.mineral_type] = acc[o.mineral_type] ?? { count: 0, value: 0 }
      acc[o.mineral_type].count += 1
      acc[o.mineral_type].value += Number(o.total_zar)
      return acc
    }, {})

    sendSuccess(res, {
      total_orders: orders.length,
      total_value_zar: totalValue,
      total_qty_kg: totalQty,
      by_status: byStatus,
      by_mineral: byMineral,
      filters_applied: {
        date_from: filters.date_from ?? null,
        date_to: filters.date_to ?? null,
        status: filters.status ?? null,
        mineral_type: filters.mineral_type ?? null,
      },
    })
  } catch (err) {
    console.error('[getSummary]', err)
    sendError(res, 'Failed to generate summary.')
  }
}

// GET /api/reports/export/excel

export async function exportExcel(req: Request, res: Response): Promise<void> {
  try {
    const { filters, error: filterError } = parseReportFilters(req.query)
    if (filterError) {
      sendError(res, filterError, 400)
      return
    }

    const result = await OrdersService.getOrders(filters)

    if (result.items.length === 0) {
      sendError(res, 'No orders found for the selected filters.', 404)
      return
    }

    const buffer = await ReportsService.buildExcelReport(result.items, {
      date_from: filters.date_from,
      date_to: filters.date_to,
      status: filters.status,
    })

    // Build a descriptive filename including the date range
    const datePart = filters.date_from && filters.date_to
      ? `_${filters.date_from}_to_${filters.date_to}`
      : `_${new Date().toISOString().slice(0, 10)}`

    const filename = `mare_oms_orders${datePart}.xlsx`

    /*
     * File streaming headers:
     *  Content-Type        — tells the browser this is an XLSX file
     *  Content-Disposition — forces a download rather than inline render
     *  Content-Length      — lets the browser show a progress indicator
     *  Cache-Control       — prevents stale cached exports
     */
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

    res.status(200).end(buffer)
  } catch (err) {
    console.error('[exportExcel]', err)
    /* Only send an error response if headers have not already been flushed */
    if (!res.headersSent) {
      sendError(res, 'Failed to generate Excel report.')
    }
  }
}

// GET /api/reports/export/pdf

export async function exportPdf(req: Request, res: Response): Promise<void> {
  try {
    const { filters, error: filterError } = parseReportFilters(req.query)
    if (filterError) {
      sendError(res, filterError, 400)
      return
    }

    const result = await OrdersService.getOrders(filters)

    if (result.items.length === 0) {
      sendError(res, 'No orders found for the selected filters.', 404)
      return
    }

    const buffer = await ReportsService.buildPdfReport(result.items, {
      date_from: filters.date_from,
      date_to: filters.date_to,
      status: filters.status,
    })

    const datePart = filters.date_from && filters.date_to
      ? `_${filters.date_from}_to_${filters.date_to}`
      : `_${new Date().toISOString().slice(0, 10)}`

    const filename = `mare_oms_orders${datePart}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

    res.status(200).end(buffer)
  } catch (err) {
    console.error('[exportPdf]', err)
    if (!res.headersSent) {
      sendError(res, 'Failed to generate PDF report.')
    }
  }
}