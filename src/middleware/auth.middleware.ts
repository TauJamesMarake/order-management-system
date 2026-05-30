import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db/supabase'    /* moved to top-level import */
import { UserRole } from '../types'
import { sendError } from '../utils/response'

/**
 * Anon client — used only to verify the incoming JWT.
 */
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
  )
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey)

/**
 * verifyToken
 *
 * Express middleware that:
 *  1. Extracts the Bearer token from the Authorization header.
 *  2. Validates it with Supabase Auth.
 *  3. Loads the matching user profile from the users table.
 *  4. Rejects deactivated accounts.
 *  5. Stamps req.user so downstream handlers can read role / id.
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'No token provided. Include Authorization: Bearer <token>', 401)
      return
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      sendError(res, 'Malformed authorization header.', 401)
      return
    }

    /* Validate the JWT with Supabase Auth */
    const { data: { user: authUser }, error: authError } =
      await anonClient.auth.getUser(token)

    if (authError || !authUser) {
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    /* Load the application profile (role, is_active) */
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile) {
      sendError(res, 'User account not found. Contact your administrator.', 401)
      return
    }

    if (!profile.is_active) {
      sendError(res, 'Your account has been deactivated. Contact your administrator.', 403)
      return
    }

    /* Stamp the request — available to all downstream handlers */
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
    }

    next()
  } catch (err) {
    console.error('[verifyToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}