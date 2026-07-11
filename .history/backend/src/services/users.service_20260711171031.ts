import { supabase } from '../db/supabase'
import { createClient } from '@supabase/supabase-js'
import { iUser, UserRole } from '../types'

const adminAuthClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Create
export async function createUser(dto: {
  email: string
  password: string
  full_name: string
  role: UserRole
}, businessId): Promise<iUser> {
  // Phase 1: Create Supabase Auth account
  const { data: authData, error: authError } = await adminAuthClient
    .auth
    .admin
    .createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true, // skip confirmation email since admin is creating the account
    })

  if (authError || !authData.user) {
    throw new Error(`Failed to create auth account: ${authError?.message}`)
  }

  const authUserId = authData.user.id

  // Phase 2: Insert profile into our users table using the same UUID
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      email: dto.email,
      full_name: dto.full_name,
      role: dto.role,
    })
    .select()
    .single()

  if (profileError || !profile) {
    // Rollback: delete the Auth account so it doesn't become an orphan
    await adminAuthClient.auth.admin.deleteUser(authUserId)
    throw new Error(`Failed to create user profile: ${profileError?.message}`)
  }

  return profile as iUser
}

// Get all users
export async function getUsers(filters?: {
  role?: UserRole
  is_active?: boolean
}): Promise<iUser[]> {
  let query = supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.role !== undefined) {
    query = query.eq('role', filters.role)
  }

  // is_active can be true or false
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch users: ${error.message}`)
  return (data ?? []) as iUser[]
}

// Get one
export async function getUserById(id: string): Promise<iUser> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('User not found.')
  return data as iUser
}

/*
UPDATE PROFILE
Admin can update any field including role.
A clerk updating their own profile can only change full_name.
*/
export async function updateUser(
  id: string,
  dto: {
    full_name?: string
    role?: UserRole
    is_active?: boolean
  }
): Promise<iUser> {
  // Build payload from only the provided fields
  const payload: Partial<typeof dto> = {}
  if (dto.full_name !== undefined) payload.full_name = dto.full_name.trim()
  if (dto.role !== undefined) payload.role = dto.role
  if (dto.is_active !== undefined) payload.is_active = dto.is_active

  if (Object.keys(payload).length === 0) {
    throw new Error('No valid fields provided for update.')
  }

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to update user: ${error?.message}`)
  }

  return data as iUser
}

// DEACTIVATE (soft delete)
export async function deactivateUser(id: string): Promise<iUser> {
  const current = await getUserById(id)

  if (!current.is_active) {
    throw new Error('User is already deactivated.')
  }

  // Ban in Supabase Auth — invalidates existing JWTs
  await adminAuthClient.auth.admin.updateUserById(id, { ban_duration: '876600h' }) // 100 years

  const updated = await updateUser(id, { is_active: false })
  return updated
}

// REACTIVATE
export async function reactivateUser(id: string): Promise<iUser> {
  const current = await getUserById(id)

  if (current.is_active) {
    throw new Error('User is already active.')
  }

  // Unban in Supabase Auth
  await adminAuthClient.auth.admin.updateUserById(id, { ban_duration: 'none' })

  const updated = await updateUser(id, { is_active: true })
  return updated
}