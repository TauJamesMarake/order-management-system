import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { UserRole } from '../types'
import { sendError } from '../utils/response'

const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

function toOneRecord<T>(data: T | T[] | null | undefined): T | null {
  if (data == null) return null
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Step 1: Extract token
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

    // Step 2: Verify JWT with Supabase Auth
    const {
      data: { user: authUser },
      error: authError,
    } = await anonClient.auth.getUser(token)

    if (authError || !authUser) {
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    // Step 3: Load user profile + business in one query
    const { supabase } = await import('../db/supabase')
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        is_active,
        business_id,
        business:businesses!inner (
          is_active
        )
      `)
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile) {
      sendError(res, 'User account not found. Contact your administrator.', 401)
      return
    }

    // Step 4: Reject deactivated users
    if (!profile.is_active) {
      sendError(res, 'Your account has been deactivated. Contact your administrator.', 403)
      return
    }

    // Step 5: Reject suspended businesses
    const business = toOneRecord(profile.business)

    if (!business) {
      sendError(res, 'Business account not found. Contact the administrator.', 401)
      return
    }

    if (!business.is_active) {
      sendError(
        res,
        'This business account has been suspended. Contact the administrator.',
        403
      )
      return
    }

    // Step 6
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      business_id: profile.business_id,
    }

    // Step 7: Proceed
    next()

  } catch (err) {
    console.error('[verifyToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}

export async function verifyPlatformToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Step 1: Extract token
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'No token provided.', 401)
      return
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      sendError(res, 'Malformed authorization header.', 401)
      return
    }

    // Step 2: Verify JWT
    const {
      data: { user: authUser },
      error: authError,
    } = await anonClient.auth.getUser(token)

    if (authError || !authUser) {
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    const { supabase } = await import('../db/supabase')

    const { data: admin, error: adminError } = await supabase
      .from('platform_admins')
      .select('id, email, is_active')
      .eq('id', authUser.id)
      .single()

    if (adminError || !admin) {
      // if a business user hits a platform route,
      // they get a generic 401, not confirmation that the route exists
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    if (!admin.is_active) {
      sendError(res, 'This platform admin account has been deactivated.', 403)
      return
    }

    req.platformAdmin = {
      id: admin.id,
      email: admin.email,
    }

    next()

  } catch (err) {
    console.error('[verifyPlatformToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}