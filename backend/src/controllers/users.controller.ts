import { Request, Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import * as UsersService from '../services/users.service'

// ─────────────────────────────────────────────────────────────
// Users Controller
//
// Two access patterns:
//   Admin → full access to all user operations
//   Clerk/Viewer → can only GET and PATCH their own profile,
//                  and only full_name (not role or is_active)
//
// Ownership enforcement happens here in the controller,
// not in the service — the service just runs the query.
// ─────────────────────────────────────────────────────────────

const CreateUserSchema = z.object({
    email: z.string().email('Invalid email.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    full_name: z.string().min(2).max(255),
    role: z.enum(['admin', 'clerk', 'viewer']),
})

const AdminUpdateSchema = z.object({
    full_name: z.string().min(2).max(255).optional(),
    role: z.enum(['admin', 'clerk', 'viewer']).optional(),
    is_active: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required.' })

// Self-update: only full_name is allowed — no role or is_active
const SelfUpdateSchema = z.object({
    full_name: z.string().min(2).max(255),
})

// ── GET /api/users ───────────────────────────────────────────
// Admin only — enforced in route, not here
export async function getUsers(req: Request, res: Response): Promise<void> {
    try {
        const filters = {
            role: req.query.role as string | undefined as any,
            is_active: req.query.is_active !== undefined
                ? req.query.is_active === 'true'
                : undefined,
        }

        const users = await UsersService.getUsers(filters)
        sendSuccess(res, users)
    } catch (err) {
        console.error('[getUsers]', err)
        sendError(res, 'Failed to fetch users.')
    }
}

// ── GET /api/users/:id ───────────────────────────────────────
// Admin: any user. Clerk/Viewer: own profile only.
export async function getUserById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params
        const requestingUser = req.user!

        // Non-admins can only view their own profile
        if (requestingUser.role !== 'admin' && requestingUser.id !== id) {
            sendError(res, 'Access denied. You can only view your own profile.', 403)
            return
        }

        const user = await UsersService.getUserById(id)
        sendSuccess(res, user)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch user.'
        sendError(res, message, message.includes('not found') ? 404 : 500)
    }
}

// ── POST /api/users ──────────────────────────────────────────
// Admin only — enforced in route
export async function createUser(req: Request, res: Response): Promise<void> {
    try {
        const parsed = CreateUserSchema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        const user = await UsersService.createUser(parsed.data)
        sendSuccess(res, user, 'User created successfully.', 201)
    } catch (err) {
        console.error('[createUser]', err)
        const message = err instanceof Error ? err.message : 'Failed to create user.'
        // Supabase returns a specific message for duplicate email
        const status = message.includes('already') ? 409 : 500
        sendError(res, message, status)
    }
}

// ── PATCH /api/users/:id ─────────────────────────────────────
// Admin: can update full_name, role, is_active
// Self (clerk/viewer): can only update full_name
export async function updateUser(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params
        const requestingUser = req.user!
        const isAdmin = requestingUser.role === 'admin'
        const isSelf = requestingUser.id === id

        // Non-admins cannot modify other users
        if (!isAdmin && !isSelf) {
            sendError(res, 'Access denied. You can only update your own profile.', 403)
            return
        }

        // Non-admins use restricted schema — only full_name allowed
        const schema = isAdmin ? AdminUpdateSchema : SelfUpdateSchema
        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        // Extra guard: non-admin cannot sneak in role or is_active
        // even if the schema somehow passed (defence in depth)
        const safePayload = isAdmin
            ? parsed.data
            : { full_name: (parsed.data as { full_name: string }).full_name }

        const updated = await UsersService.updateUser(id, safePayload)
        sendSuccess(res, updated, 'User updated successfully.')
    } catch (err) {
        console.error('[updateUser]', err)
        const message = err instanceof Error ? err.message : 'Failed to update user.'
        sendError(res, message, message.includes('not found') ? 404 : 500)
    }
}

// ── PATCH /api/users/:id/deactivate ─────────────────────────
// Admin only — enforced in route
export async function deactivateUser(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params

        // Prevent admin from deactivating themselves
        if (req.user!.id === id) {
            sendError(res, 'You cannot deactivate your own account.', 400)
            return
        }

        const user = await UsersService.deactivateUser(id)
        sendSuccess(res, user, 'User deactivated successfully.')
    } catch (err) {
        console.error('[deactivateUser]', err)
        const message = err instanceof Error ? err.message : 'Failed to deactivate user.'
        const status = message.includes('not found') ? 404
            : message.includes('already') ? 400
                : 500
        sendError(res, message, status)
    }
}

// ── PATCH /api/users/:id/reactivate ─────────────────────────
// Admin only — enforced in route
export async function reactivateUser(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params
        const user = await UsersService.reactivateUser(id)
        sendSuccess(res, user, 'User reactivated successfully.')
    } catch (err) {
        console.error('[reactivateUser]', err)
        const message = err instanceof Error ? err.message : 'Failed to reactivate user.'
        const status = message.includes('not found') ? 404
            : message.includes('already') ? 400
                : 500
        sendError(res, message, status)
    }
}