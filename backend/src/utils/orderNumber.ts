import { supabase } from '../db/supabase'

// Generates: ND-2026-0001, ND-2026-0002, etc.
// Queries the DB for the highest order number this year and increments.
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ND-${year}-`

  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Failed to generate order number: ${error.message}`)

  if (!data || data.length === 0) {
    return `${prefix}0001`
  }

  const lastNumber = data[0].order_number // e.g. "ND-2026-0043"
  const lastSequence = parseInt(lastNumber.split('-')[2], 10)
  const next = String(lastSequence + 1).padStart(4, '0')

  return `${prefix}${next}`
}
