import { Request, Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import * as UsersService from '../services/users.service'



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
        console.error('[getUserById]', err)
        sendError(res, 'Failed to fetch user.', 500)
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
        // Never forward internal error details to the client
        sendError(res, 'Failed to create user.', 500)
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
        sendError(res, 'Failed to update user.', 500)
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
        sendError(res, 'Failed to deactivate user.', 500)
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
        sendError(res, 'Failed to reactivate user.', 500)
    }
}