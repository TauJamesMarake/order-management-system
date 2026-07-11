import { supabase } from '../db/supabase'

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