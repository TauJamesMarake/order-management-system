import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { UserRole } from '../types'
import { sendError } from '../utils/response'

// Supabase anon client
const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// verifyToken
//
// Protects all business-scoped API routes.
//
// Flow:
//   1. Extract + validate Bearer token from Authorization header
//   2. Verify JWT with Supabase Auth
//   3. Load user profile + business status in ONE query (inner join)
//   4. Reject deactivated users (403)
//   5. Reject suspended businesses (403)
//   6. Stamp req.user = { id, email, role, business_id }
//   7. next()
//
// On any failure: returns the appropriate HTTP error and does NOT
// call next() — the request is terminated here.

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
    //
    // businesses!inner enforces the FK join:
    //   - If the user's business_id has no matching businesses row
    //     (shouldn't happen with FK constraint, but defensive), the
    //     inner join returns no row → profile will be null → 401 below.

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

    // ── Step 5: Reject suspended businesses
    //
    // profile.business is typed as { is_active: boolean } from the
    // inner join above. Cast required because Supabase JS types the
    // joined relation as an object or array depending on cardinality.
    //
    // businesses has a 1:1 relationship with users via business_id FK,
    // so PostgREST returns a single object, not an array.
    const business = profile.business as { is_active: boolean } | null

    if (!business) {
      // Defensive: FK constraint prevents this, but guard anyway
      sendError(res, 'Business account not found. Contact the platform administrator.', 401)
      return
    }

    if (!business.is_active) {
      sendError(
        res,
        'This business account has been suspended. Contact the platform administrator.',
        403
      )
      return
    }

    // ── Step 6: Stamp req.user ────────────────────────────
    //
    // business_id is sourced exclusively from the database record —
    // never from the token payload or client request. This is the
    // authoritative tenant identity for all downstream handlers.
    req.user = {
      id:          profile.id,
      email:       profile.email,
      role:        profile.role as UserRole,
      business_id: profile.business_id,
    }

    // ── Step 7: Proceed ───────────────────────────────────
    next()

  } catch (err) {
    console.error('[verifyToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}

// ─────────────────────────────────────────────────────────────
// verifyPlatformToken — NEW in Phase 1
//
// Protects all /api/platform/* routes.
// Completely separate from verifyToken — different table,
// different req property, different error messages.
//
// Platform admins authenticate via Supabase Auth (same mechanism)
// but their profile row lives in platform_admins, not users.
// They have NO business_id and NO access to order data.
//
// Flow:
//   1. Extract + validate Bearer token
//   2. Verify JWT with Supabase Auth
//   3. Load platform_admin profile — rejects if not found
//   4. Reject deactivated platform admins
//   5. Stamp req.platformAdmin = { id, email }
//   6. next()
// ─────────────────────────────────────────────────────────────

export async function verifyPlatformToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ── Step 1: Extract token ──────────────────────────────
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

    // ── Step 2: Verify JWT ────────────────────────────────
    const {
      data: { user: authUser },
      error: authError,
    } = await anonClient.auth.getUser(token)

    if (authError || !authUser) {
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    // ── Step 3: Load platform admin profile ───────────────
    const { supabase } = await import('../db/supabase')

    const { data: admin, error: adminError } = await supabase
      .from('platform_admins')
      .select('id, email, is_active')
      .eq('id', authUser.id)
      .single()

    if (adminError || !admin) {
      // Deliberately vague — if a business user hits a platform route,
      // they get a generic 401, not confirmation that the route exists
      sendError(res, 'Invalid or expired token. Please log in again.', 401)
      return
    }

    // ── Step 4: Reject deactivated platform admins ────────
    if (!admin.is_active) {
      sendError(res, 'This platform admin account has been deactivated.', 403)
      return
    }

    // ── Step 5: Stamp req.platformAdmin ──────────────────
    req.platformAdmin = {
      id:    admin.id,
      email: admin.email,
    }

    // ── Step 6: Proceed ───────────────────────────────────
    next()

  } catch (err) {
    console.error('[verifyPlatformToken] Unexpected error:', err)
    sendError(res, 'Authentication error.', 500)
  }
}