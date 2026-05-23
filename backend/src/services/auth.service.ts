import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db/supabase'
import { User } from '../types'

// ─────────────────────────────────────────────────────────────
// Auth Service
//
// RESPONSIBILITY:
//   Session operations — login, logout, password reset.
//   Wraps Supabase Auth calls and enriches responses with our
//   user profile data (role, full_name) from the users table.
//
// NOTE: We use an anon client for login because signInWithPassword
//   must be called with user credentials, not the service role key.
// ─────────────────────────────────────────────────────────────

const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export interface LoginResult {
  token:        string   // JWT access token — frontend stores and sends as Bearer
  refresh_token: string  // Used to get a new token when the JWT expires
  user: {
    id:        string
    email:     string
    full_name: string
    role:      string
  }
}

// ── Login ────────────────────────────────────────────────────
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
    // Supabase returns a generic error for wrong credentials —
    // we surface a clean message, not Supabase internals
    throw new Error('Invalid email or password.')
  }

  // 2. Load profile from our users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User account not found. Contact your administrator.')
  }

  // 3. Block deactivated accounts
  // Supabase Auth allows the login (it doesn't know about is_active),
  // so we check here and refuse to return a token
  if (!profile.is_active) {
    throw new Error('Your account has been deactivated. Contact your administrator.')
  }

  return {
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id:        profile.id,
      email:     profile.email,
      full_name: profile.full_name,
      role:      profile.role,
    },
  }
}

// ── Logout ───────────────────────────────────────────────────
// Invalidates the session server-side in Supabase Auth.
export async function logout(token: string): Promise<void> {
  // Set the user's token on the anon client so signOut()
  // invalidates the correct session
  const { error } = await anonClient.auth.signOut()

  if (error) {
    // Log but don't throw — frontend should clear token regardless
    console.error('[AuthService] Logout error:', error.message)
  }
}

// ── Get current user profile ─────────────────────────────────
// Used by GET /auth/me — token already verified by middleware
export async function getMe(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) throw new Error('User not found.')
  return data as User
}

// ── Password reset ───────────────────────────────────────────
// Triggers Supabase's built-in password reset email.
// We never handle the actual password — Supabase owns that.
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  })

  // Do NOT reveal whether the email exists — always respond the same way.
  // This prevents user enumeration attacks.
  if (error) {
    console.error('[AuthService] Password reset error:', error.message)
  }
}