import { Request, Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import * as PlatformAuthService from '../services/platform_auth.service'
import * as PlatformService from '../services/platform.service'

const LoginSchema = z.object({
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
})

const SuspendSchema = z.object({
    reason: z.string()
        .min(10, 'Suspension reason must be at least 10 characters.')
        .max(500, 'Suspension reason must not exceed 500 characters.'),
})

// POST /api/platform/auth/login
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const parsed = LoginSchema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        const result = await PlatformAuthService.login(
            parsed.data.email,
            parsed.data.password,
        )

        sendSuccess(res, result, 'Login successful.')
    } catch (err) {
        sendError(res, 'Invalid email or password.', 401)
    }
}

// GET /api/platform/businesses
export async function getBusinesses(req: Request, res: Response): Promise<void> {
    try {
        const businesses = await PlatformService.getBusinesses()
        sendSuccess(res, businesses)
    } catch (err) {
        console.error('[getBusinesses]', err)
        sendError(res, 'Failed to fetch businesses.')
    }
}

// GET /api/platform/businesses/:id
export async function getBusinessById(req: Request, res: Response): Promise<void> {
    try {
        const business = await PlatformService.getBusinessById(req.params.id)
        sendSuccess(res, business)
    } catch (err) {
        console.error('[getBusinessById]', err)
        const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
        sendError(res, 'Failed to fetch business.', status)
    }
}

// PATCH /api/platform/businesses/:id/suspend
export async function suspendBusiness(req: Request, res: Response): Promise<void> {
    try {
        const parsed = SuspendSchema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        const business = await PlatformService.suspendBusiness(
            req.params.id,
            parsed.data.reason,
        )

        sendSuccess(res, business, 'Business suspended successfully.')
    } catch (err) {
        console.error('[suspendBusiness]', err)

        const message = err instanceof Error ? err.message : ''
        const status =
            message.includes('not found') ? 404
                : message.includes('already suspended') ? 400
                    : 500

        sendError(res, message || 'Failed to suspend business.', status)
    }
}

// PATCH /api/platform/businesses/:id/reactivate
export async function reactivateBusiness(req: Request, res: Response): Promise<void> {
    try {
        const business = await PlatformService.reactivateBusiness(req.params.id)
        sendSuccess(res, business, 'Business reactivated successfully.')
    } catch (err) {
        console.error('[reactivateBusiness]', err)

        const message = err instanceof Error ? err.message : ''
        const status =
            message.includes('not found') ? 404
                : message.includes('already active') ? 400
                    : 500

        sendError(res, message || 'Failed to reactivate business.', status)
    }
}