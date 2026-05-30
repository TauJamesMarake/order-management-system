import { Request, Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import * as AuthService from '../services/auth.service'



const LoginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

const ResetSchema = z.object({
  email: z.string().email('Invalid email address.'),
})

// ── POST /api/auth/login ─────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    const result = await AuthService.login(parsed.data.email, parsed.data.password)

    sendSuccess(res, result, 'Login successful.')
  } catch (err) {
    // Use 401 for auth failures, not 500
    // Client-safe errors only (avoid leaking internals)
    const status = err instanceof Error ? 401 : 500
    sendError(res, 'Login failed.', status)
  }
}

// ── POST /api/auth/logout ────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1] ?? ''
    await AuthService.logout(token)
    sendSuccess(res, null, 'Logged out successfully.')
  } catch (err) {
    // Always return 200 on logout — client should clear token regardless
    sendSuccess(res, null, 'Logged out.')
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────
// verifyToken runs before this — req.user is guaranteed
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const profile = await AuthService.getMe(req.user!.id)
    sendSuccess(res, profile)
  } catch (err) {
    sendError(res, 'Failed to fetch profile.', 500)
  }
}

// ── POST /api/auth/reset-password ───────────────────────────
export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    const parsed = ResetSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    await AuthService.requestPasswordReset(parsed.data.email)

    // Always return the same response — don't reveal if email exists
    sendSuccess(res, null, 'If that email is registered, a reset link has been sent.')
  } catch (err) {
    sendSuccess(res, null, 'If that email is registered, a reset link has been sent.')
  }
}