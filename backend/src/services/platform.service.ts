import { supabase } from '../db/supabase'
import { iBusiness } from '../types'
export async function getBusinesses(): Promise<iBusiness[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, order_prefix, is_active, suspended_at, suspended_reason, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error('Failed to fetch businesses.')
  return (data ?? []) as iBusiness[]
}

export async function getBusinessById(id: string): Promise<iBusiness> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, order_prefix, is_active, suspended_at, suspended_reason, created_at')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('Business not found.')
  return data as iBusiness
}

export async function suspendBusiness(
  id:     string,
  reason: string,
): Promise<iBusiness> {
  const current = await getBusinessById(id)

  if (!current.is_active) {
    throw new Error('Business is already suspended.')
  }

  const { data, error } = await supabase
    .from('businesses')
    .update({
      is_active:        false,
      suspended_at:     new Date().toISOString(),
      suspended_reason: reason.trim(),
    })
    .eq('id', id)
    .select('id, name, order_prefix, is_active, suspended_at, suspended_reason, created_at')
    .single()

  if (error || !data) throw new Error('Failed to suspend business.')
  return data as iBusiness
}

export async function reactivateBusiness(id: string): Promise<iBusiness> {
  const current = await getBusinessById(id)

  if (current.is_active) {
    throw new Error('Business is already active.')
  }

  const { data, error } = await supabase
    .from('businesses')
    .update({
      is_active:        true,
      suspended_at:     null,
      suspended_reason: null,
    })
    .eq('id', id)
    .select('id, name, order_prefix, is_active, suspended_at, suspended_reason, created_at')
    .single()

  if (error || !data) throw new Error('Failed to reactivate business.')
  return data as iBusiness
}