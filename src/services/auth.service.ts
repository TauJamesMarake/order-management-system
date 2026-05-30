import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db/supabase'
import { iUser } from '../types'

/**
 * Auth Service
 *
 * Handles session operations: login, logout, and password reset.
 * Wraps Supabase Auth and enriches responses with application profile data
 * (role, full_name) from the users table.
 *
 * NOTE: signInWithPassword must be called with the anon key — not the
 * service-role key — because it operates on behalf of the user.
 */

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

/**
 * Shared anon client used only for password reset.
 * Login and logout each construct a short-lived client seeded with the
 * appropriate credentials so sessions are correctly scoped.
 */
const anonClient = createClient(supabaseUrl, supabaseAnonKey)

/* Types */
export interface iLoginResult {
  /** JWT access token — frontend stores and sends as Authorization: Bearer */
  token: string
  /** Refresh token obtain a new JWT when the current one expires */
  refresh_token: string
  user: {
    id: string
    email: string
    full_name: string
    role: string
  }
}

/* Login */

/**
 * Authenticates the user via Supabase Auth and returns a JWT plus profile.
 *
 * Steps:
 *  1. Validate credentials with Supabase.
 *  2. Load the application profile (role, full_name, is_active).
 *  3. Block deactivated accounts before issuing a token.
 */
export async function login(
  email: string,
  password: string
): Promise<iLoginResult> {

  /* Step 1 Supabase Auth credential check */
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session || !data.user) {
    throw new Error('Invalid email or password.')
  }

  /* Step 2 Load application profile */
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User account not found. Contact your administrator.')
  }

  /* Step 3 Block deactivated accounts
   *
   * Supabase Auth allows the login because it does not know about is_active.
   * We check here and refuse to return a token rather than relying on the
   * ban_duration set during deactivation (belt-and-suspenders).
   */
  if (!profile.is_active) {
    throw new Error('Your account has been deactivated. Contact your administrator.')
  }

  return {
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    },
  }
}

/* Logout */
export async function logout(token: string): Promise<void> {
  /* Build a per-request client that carries the user's own token */
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { error } = await userClient.auth.signOut()

  if (error) {
    /* Log but do not throw — the frontend should clear its local token
     * regardless of whether the server-side revocation succeeded. */
    console.error('[AuthService] Logout error:', error.message)
  }
}

/* Get current user profile */
export async function getMe(userId: string): Promise<iUser> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new Error('User not found.')
  }

  return data as iUser
}

/* Password reset */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  })

  if (error) {
    console.error('[AuthService] Password reset error:', error.message)
  }
}