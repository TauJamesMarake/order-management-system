import { supabase } from '../db/supabase'

/*
FORMAT: {BUSINESS_PREFIX}-{YEAR}-{SEQUENCE}
  e.g.  ND-2026-0001   (Ntsoaki Distributions, first of 2026)
        ABC-2026-0042  (another business, 42nd of 2026)

The prefix comes from businesses.order_prefix (set at
provisioning time, immutable). The per-business, per-year
counter lives in order_counters and is managed entirely by
the DB function — never read or written directly by the app.
*/
export async function generateOrderNumber(businessId: string): Promise<string> {
  const year = new Date().getFullYear() as unknown as number

  const { data, error } = await supabase.rpc('fn_next_order_number', {
    p_business_id: businessId,
    p_year: year,
  })

  if (error || data === null || data === undefined) {
    throw new Error(
      `Failed to generate order number: ${error?.message ?? 'null returned from fn_next_order_number'}`
    )
  }

  return data as string
}