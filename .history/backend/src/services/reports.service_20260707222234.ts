import ExcelJS from 'exceljs'
import { iOrder } from '../types'

/*
 * RESPONSIBILITY:
 *   Transform raw order data into downloadable file buffers.
 *   Returns a Buffer — the controller streams it to the client.
 * TWO OUTPUTS:
 *   buildExcelReport() → .xlsx buffer via ExcelJS
 *   buildPdfReport()   → .pdf buffer via jsPDF + autoTable
*/

// Shared formatting helpers
function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Status badge colours for Excel
const STATUS_COLOURS: Record<string, { bg: string; font: string }> = {
  pending: { bg: 'FFF3CD', font: '856404' },
  confirmed: { bg: 'CCE5FF', font: '004085' },
  dispatched: { bg: 'D1ECF1', font: '0C5460' },
  delivered: { bg: 'D4EDDA', font: '155724' },
  cancelled: { bg: 'F8D7DA', font: '721C24' },
}

// Excel Report
export async function buildExcelReport(
  orders: iOrder[],
  filters: { date_from?: string; date_to?: string; status?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // Workbook metadata
  workbook.creator = 'Mare OMS'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Sheet 1: Orders
  const sheet = workbook.addWorksheet('Orders', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  })

  // Column definitions
  sheet.columns = [
    { header: 'Order #', key: 'order_number', width: 18 },
    { header: 'Client', key: 'client_name', width: 28 },
    { header: 'Mineral', key: 'mineral_type', width: 18 },
    { header: 'Qty (kg)', key: 'quantity_kg', width: 14 },
    { header: 'Unit Price', key: 'unit_price', width: 16 },
    { header: 'Total (ZAR)', key: 'total', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created By', key: 'creator', width: 22 },
    { header: 'Date', key: 'created_at', width: 16 },
  ]

  // Title block
  sheet.insertRow(1, [])
  sheet.insertRow(2, [])

  const titleRow = sheet.getRow(1)
  titleRow.getCell(1).value = 'MARE — ORDER REPORT'
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }

  const subtitleParts: string[] = []
  if (filters.date_from) subtitleParts.push(`From: ${formatDate(filters.date_from)}`)
  if (filters.date_to) subtitleParts.push(`To: ${formatDate(filters.date_to)}`)
  if (filters.status) subtitleParts.push(`Status: ${capitalise(filters.status)}`)
  subtitleParts.push(`Generated: ${formatDate(new Date().toISOString())}`)

  const subtitleRow = sheet.getRow(2)
  subtitleRow.getCell(1).value = subtitleParts.join('   |   ')
  subtitleRow.getCell(1).font = { size: 9, color: { argb: 'FF666666' } }

  sheet.addRow([]) // spacer

  // Header row (row 4)
  const headerRow = sheet.getRow(4)
  sheet.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = typeof col.header === "string" ? col.header : String(col.header ?? "")
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.height = 22

  // Data rows
  orders.forEach((order, i) => {
    const row = sheet.addRow({
      order_number: order.order_number,
      client_name: order.client_name,
      mineral_type: order.mineral_type,
      quantity_kg: Number(order.quantity_kg),
      unit_price: Number(order.unit_price_zar),
      total: Number(order.total_zar),
      status: capitalise(order.status),
      creator: (order as any).creator_name ?? 'Unknown',
      created_at: formatDate(order.created_at),
    })

    // Alternate row shading
    const rowFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5' },
    }

    row.eachCell(cell => {
      cell.fill = rowFill
      cell.font = { size: 9 }
      cell.alignment = { vertical: 'middle' }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
      }
    })

    // Number formatting for currency and quantity cells
    row.getCell(4).numFmt = '#,##0.000'
    row.getCell(5).numFmt = 'R#,##0.00'
    row.getCell(6).numFmt = 'R#,##0.00'
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).alignment = { horizontal: 'right' }

    // Status badge colour
    const colours = STATUS_COLOURS[order.status]
    if (colours) {
      const statusCell = row.getCell(7)
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colours.bg}` } }
      statusCell.font = { size: 9, color: { argb: `FF${colours.font}` }, bold: true }
      statusCell.alignment = { horizontal: 'center' }
    }

    row.height = 18
  })

  // Summary block
  sheet.addRow([])
  const totalValue = orders.reduce((sum, o) => sum + Number(o.total_zar), 0)
  const activeOrders = orders.filter(o =>
    ['pending', 'confirmed', 'dispatched'].includes(o.status)
  )

  const summaryData = [
    ['Total Orders', orders.length],
    ['Active Orders', activeOrders.length],
    ['Delivered', orders.filter(o => o.status === 'delivered').length],
    ['Cancelled', orders.filter(o => o.status === 'cancelled').length],
    ['Total Value (ZAR)', formatZAR(totalValue)],
  ]

  summaryData.forEach(([label, value]) => {
    const row = sheet.addRow([label, value])
    row.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF1E3A5F' } }
    row.getCell(2).font = { size: 9 }
  })

  // Freeze panes so header stays visible when scrolling
  sheet.views = [{ state: 'frozen', ySplit: 4 }]

  // Sheet 2: Summary by Mineral
  const mineralSheet = workbook.addWorksheet('By Mineral')
  mineralSheet.columns = [
    { header: 'Mineral Type', key: 'mineral', width: 22 },
    { header: 'Order Count', key: 'count', width: 14 },
    { header: 'Total Qty (kg)', key: 'qty', width: 18 },
    { header: 'Total Value', key: 'value', width: 18 },
  ]

  // Style mineral sheet header
  const mHeader = mineralSheet.getRow(1)
  mHeader.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { horizontal: 'center' }
  })
  mHeader.height = 20

  // Aggregate by mineral type
  const mineralMap = new Map<string, { count: number; qty: number; value: number }>()
  orders.forEach(o => {
    const key = o.mineral_type
    const curr = mineralMap.get(key) ?? { count: 0, qty: 0, value: 0 }
    mineralMap.set(key, {
      count: curr.count + 1,
      qty: curr.qty + Number(o.quantity_kg),
      value: curr.value + Number(o.total_zar),
    })
  })

  Array.from(mineralMap.entries())
    .sort((a, b) => b[1].value - a[1].value) // sort by value descending
    .forEach(([mineral, stats], i) => {
      const row = mineralSheet.addRow([
        mineral,
        stats.count,
        stats.qty,
        formatZAR(stats.value),
      ])
      row.getCell(3).numFmt = '#,##0.000'
      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FA' },
        }
        cell.font = { size: 9 }
      })
    })

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// PDF Report
// Uses jsPDF + jspdf-autotable.
// Returns a Buffer the controller streams to the client.
export async function buildPdfReport(
  orders: iOrder[],
  filters: { date_from?: string; date_to?: string; status?: string }
): Promise<Buffer> {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const doc = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const BLUE = [30, 58, 95]   // #1E3A5F
  const MID = [46, 117, 182]  // #2E75B6
  const GRAY = [245, 245, 245]
  const WHITE = [255, 255, 255]
  const BLACK = [34, 34, 34]

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  // Header bar
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, pageW, 18, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('MARE OMS', margin, 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Order Management System — Export Report', margin, 13.5)

  // Filter subtitle
  doc.setTextColor(...BLACK)
  doc.setFontSize(8)
  const parts: string[] = []
  if (filters.date_from) parts.push(`From: ${formatDate(filters.date_from)}`)
  if (filters.date_to) parts.push(`To: ${formatDate(filters.date_to)}`)
  if (filters.status) parts.push(`Status: ${capitalise(filters.status)}`)
  parts.push(`Generated: ${formatDate(new Date().toISOString())}`)
  doc.text(parts.join('   |   '), margin, 24)

  // Table
  const tableRows = orders.map(o => [
    o.order_number,
    o.client_name,
    o.mineral_type,
    `${Number(o.quantity_kg).toLocaleString('en-ZA')} kg`,
    formatZAR(Number(o.unit_price_zar)),
    formatZAR(Number(o.total_zar)),
    capitalise(o.status),
    (o as any).creator_name ?? '—',
    formatDate(o.created_at),
  ])

    ; (doc as any).autoTable({
      startY: 28,
      margin: { left: margin, right: margin },
      head: [['Order #', 'Client', 'Mineral', 'Qty', 'Unit Price', 'Total', 'Status', 'Created By', 'Date']],
      body: tableRows,
      headStyles: {
        fillColor: BLUE,
        textColor: WHITE,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: BLACK,
      },
      alternateRowStyles: { fillColor: GRAY },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center' },
        8: { halign: 'center' },
      },
      didDrawCell: (data: any) => {
        // Colour status column text based on status value
        if (data.section === 'body' && data.column.index === 6) {
          const status = orders[data.row.index]?.status
          const colourMap: Record<string, number[]> = {
            pending: [133, 100, 4],
            confirmed: [0, 64, 133],
            dispatched: [12, 84, 96],
            delivered: [21, 87, 36],
            cancelled: [114, 28, 36],
          }
          if (status && colourMap[status]) {
            doc.setTextColor(...colourMap[status])
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.text(
              capitalise(status),
              data.cell.x + data.cell.width / 2,
              data.cell.y + data.cell.height / 2 + 1,
              { align: 'center' }
            )
          }
        }
      },
    })

  // Summary footer
  const finalY = (doc as any).lastAutoTable.finalY + 6
  const totalValue = orders.reduce((sum, o) => sum + Number(o.total_zar), 0)

  doc.setFillColor(...MID)
  doc.rect(margin, finalY, pageW - margin * 2, 8, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(
    `Total Orders: ${orders.length}   |   Total Value: ${formatZAR(totalValue)}   |   Active: ${orders.filter(o => ['pending', 'confirmed', 'dispatched'].includes(o.status)).length}`,
    pageW / 2,
    finalY + 5,
    { align: 'center' }
  )

  // Page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount}   |   MareOMS — Confidential`,
      pageW / 2, pageH - 5, { align: 'center' }
    )
  }

  // Return as Node Buffer
  return Buffer.from(doc.output('arraybuffer'))
}
