import { supabase } from '../db/supabase'

/**
 * Generates a sequential, human-readable order number.
 * Format: ND-YYYY-XXXX  (e.g. ND-2026-0043)
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ND-${year}-`

  /* Primary: atomic Postgres sequence */
  const { data: seqData, error: seqError } = await supabase
    .rpc('fn_next_order_sequence', { p_year: year })

  if (!seqError && seqData != null) {
    const seq = String(seqData as number).padStart(4, '0')
    return `${prefix}${seq}`
  }

  /* ── Fallback: in-process increment (remove once fn is live) */
  console.warn(
    '[generateOrderNumber] fn_next_order_sequence unavailable – using fallback:',
    seqError?.message
  )

  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to generate order number: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return `${prefix}0001`
  }

  /* Extract the numeric suffix (index 2 after splitting on '-') */
  const lastSequence = parseInt(data[0].order_number.split('-')[2], 10)
  const next = String(lastSequence + 1).padStart(4, '0')

  return `${prefix}${next}`
}