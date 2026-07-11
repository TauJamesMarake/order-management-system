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

const SelfUpdateSchema = z.object({
    full_name: z.string().min(2).max(255),
})

// Inferred types
type CreateUserPayload = z.infer<typeof CreateUserSchema>
type AdminUpdatePayload = z.infer<typeof AdminUpdateSchema>

// GET /api/users
// Admin only
export async function getUsers(req: Request, res: Response): Promise<void> {
    try {
        const filters = {
            role: req.query.role as any,
            is_active: req.query.is_active !== undefined
                ? req.query.is_active === 'true'
                : undefined,
        }

        const users = await UsersService.getUsers(filters, req.user!.business_id)
        sendSuccess(res, users)
    } catch (err) {
        console.error('[getUsers]', err)
        sendError(res, 'Failed to fetch users.')
    }
}

// GET /api/users/:id

/**
 * Admin: can fetch any user.
 * Clerk / Viewer: own profile only.
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params
        const requestingUser = req.user!

        if (requestingUser.role !== 'admin' && requestingUser.id !== id) {
            sendError(res, 'Access denied. You can only view your own profile.', 403)
            return
        }

        const user = await UsersService.getUserById(id, req.user!.business_id)
        sendSuccess(res, user)
    } catch (err) {
        console.error('[getUserById]', err)
        sendError(res, 'Failed to fetch user.', 500)
    }
}

// POST /api/users
// Admin only
export async function createUser(req: Request, res: Response): Promise<void> {
    try {
        const parsed = CreateUserSchema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        /* Type is now inferred from schema, no separate interface needed */
        const dto: CreateUserPayload = parsed.data

        const user = await UsersService.createUser(dto)
        sendSuccess(res, user, 'User created successfully.', 201)
    } catch (err) {
        console.error('[createUser]', err)
        sendError(res, 'Failed to create user.', 500)
    }
}

// PATCH /api/users/:id
/**
 * Admin: can update full_name, role, is_active.
 * Clerk / Viewer (self only): can update full_name only.
 */
export async function updateUser(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params
        const requestingUser = req.user!
        const isAdmin = requestingUser.role === 'admin'
        const isSelf = requestingUser.id === id

        if (!isAdmin && !isSelf) {
            sendError(res, 'Access denied. You can only update your own profile.', 403)
            return
        }

        /* Non-admins use the restricted schema */
        const schema = isAdmin ? AdminUpdateSchema : SelfUpdateSchema
        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
            return
        }

        /*
         * Defence-in-depth: even if the schema somehow admitted extra fields,
         * non-admin callers can only reach updateUser with full_name.
         */
        const safePayload: AdminUpdatePayload = isAdmin
            ? parsed.data
            : { full_name: (parsed.data as { full_name: string }).full_name }

        const updated = await UsersService.updateUser(id, safePayload)
        sendSuccess(res, updated, 'User updated successfully.')
    } catch (err) {
        console.error('[updateUser]', err)
        sendError(res, 'Failed to update user.', 500)
    }
}

// PATCH /api/users/:id/deactivate
// Admin only
export async function deactivateUser(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params

        /* Prevent an admin from locking themselves out */
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

// PATCH /api/users/:id/reactivate

// Admin only
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