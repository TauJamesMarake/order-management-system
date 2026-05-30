import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { UserRole } from '../types'
import { sendError } from '../utils/response'

const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

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

    // Verify token with Supabase Auth
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(token)

    if (authError || !authUser) {
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    // Load profile from our users table
    const { supabase } = await import('../db/supabase')
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

    // Stamp req.user — available to all downstream handlers
    req.user = {
      id:    profile.id,
      email: profile.email,
      role:  profile.role as UserRole,
    }

    next()
  } catch (err) {
    console.error('[verifyToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}
