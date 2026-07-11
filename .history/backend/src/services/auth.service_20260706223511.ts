// ─────────────────────────────────────────────────────────────
// services/auth.service.ts
//
// PHASE 1 CHANGES:
//   LoginResult.user — added business_id field
//   login()          — selects business_id from users table,
//                      includes it in the returned payload
//
// The business_id in the login response lets the frontend store
// it in the auth store for display/context purposes only.
// It is NEVER sent back to the API as a trust signal — the API
// always resolves business_id from the verified JWT via the DB.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db/supabase'
import { iUser } from '../types'

// Anon client for password-based sign-in.
// Must NOT use service role for signInWithPassword.
const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

function toOneRecord<T>(data: T | T[] | null | undefined): T | null {
  if (data == null) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

//  Login result shape

export interface LoginResult {
  token:         string
  refresh_token: string
  user: {
    id:          string
    email:       string
    full_name:   string
    role:        string
    business_id: string    // ★ PHASE 1 — for frontend auth store context
  }
}

// ── POST /api/auth/login ─────────────────────────────────────

export async function login(
  email:    string,
  password: string
): Promise<LoginResult> {
  // 1. Authenticate with Supabase Auth
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session || !data.user) {
    // Supabase returns a generic error — surface a clean message only
    throw new Error('Invalid email or password.')
  }

  // 2. Load profile — now includes business_id
  //
  // We also check business.is_active here so login itself is blocked
  // for suspended businesses, not just subsequent API calls.
  // This gives a clear error at the login screen rather than a
  // confusing 403 on the first post-login API call.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      is_active,
      business_id,
      business:businesses!inner (
        is_active
      )
    `)
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User account not found. Contact your administrator.')
  }

  // 3. Block deactivated users
  if (!profile.is_active) {
    throw new Error('Your account has been deactivated. Contact your administrator.')
  }

  // 4. Block suspended businesses at login
  //
  // Consistent with verifyToken — same cast pattern.
  const business = toOneRecord(profile.business)

  if (!business || !business.is_active) {
    throw new Error(
      'This business account has been suspended. Contact the platform administrator.'
    )
  }

  // 5. Return full session payload
  return {
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id:          profile.id,
      email:       profile.email,
      full_name:   profile.full_name,
      role:        profile.role,
      business_id: profile.business_id,    // ★ PHASE 1
    },
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
// Invalidates the Supabase session server-side.
// Controller always returns 200 regardless — client clears token either way.

export async function logout(token: string): Promise<void> {
  const { error } = await anonClient.auth.signOut()

  if (error) {
    // Log but don't throw — frontend clears the token regardless
    console.error('[AuthService] Logout error:', error.message)
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────
// Token already verified by verifyToken middleware.
// Returns full user profile including business_id.

export async function getMe(userId: string): Promise<iUser> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) throw new Error('User not found.')
  return data as iUser
}

// ── POST /api/auth/reset-password ────────────────────────────
// Triggers Supabase's built-in password reset email flow.
// Never reveals whether the email exists — always returns the same response.

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  })

  if (error) {
    // Log but don't throw — prevents user enumeration
    console.error('[AuthService] Password reset error:', error.message)
  }
}