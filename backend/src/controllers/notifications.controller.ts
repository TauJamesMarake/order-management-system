import { Response } from 'express'
import { z } from 'zod'
import { sendSuccess, sendError } from '../utils/response'
import { iAuthenticatedRequest } from '../types'
import * as NotificationsService from '../services/notifications.service'

const CreateReminderSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(255),
  detail: z.string().max(300, 'Detail must not exceed 300 characters.').optional(),
})

const UpdateReminderSchema = z
  .object({
    title: z.string().min(1, 'Title is required.').max(255).optional(),
    detail: z.string().max(300, 'Detail must not exceed 300 characters.').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  })

const DismissSchema = z.object({
  key: z.string().min(1, 'Notification key is required.').max(100),
})

// GET /api/notifications
export async function getNotifications(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const feed = await NotificationsService.getNotificationFeed(
      req.token,
      req.user.business_id,
    )
    sendSuccess(res, feed)
  } catch (err) {
    console.error('[getNotifications]', err)
    sendError(res, 'Failed to fetch notifications.')
  }
}

// POST /api/notifications/reminders
export async function createReminder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const parsed = CreateReminderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    const reminder = await NotificationsService.createReminder(
      req.token,
      req.user.business_id,
      req.user.id,
      parsed.data,
    )

    sendSuccess(res, reminder, 'Reminder created successfully.', 201)
  } catch (err) {
    console.error('[createReminder]', err)
    sendError(res, 'Failed to create reminder.')
  }
}

// PATCH /api/notifications/reminders/:id
export async function updateReminder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const parsed = UpdateReminderSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    const reminder = await NotificationsService.updateReminder(
      req.token,
      req.user.business_id,
      id,
      parsed.data,
    )

    sendSuccess(res, reminder, 'Reminder updated successfully.')
  } catch (err) {
    console.error('[updateReminder]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to update reminder.', status)
  }
}

// PATCH /api/notifications/reminders/:id/toggle
export async function toggleReminder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const reminder = await NotificationsService.toggleReminderDone(
      req.token,
      req.user.business_id,
      id,
    )

    sendSuccess(res, reminder, 'Reminder updated successfully.')
  } catch (err) {
    console.error('[toggleReminder]', err)
    const status = err instanceof Error && err.message.includes('not found') ? 404 : 500
    sendError(res, 'Failed to toggle reminder.', status)
  }
}

// DELETE /api/notifications/reminders/:id
export async function deleteReminder(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    await NotificationsService.deleteReminder(
      req.token,
      req.user.business_id,
      id,
    )

    // Delete of a non-existent or already-deleted id is a no-op, not an
    // error — matches standard idempotent-DELETE semantics.
    sendSuccess(res, null, 'Reminder deleted successfully.')
  } catch (err) {
    console.error('[deleteReminder]', err)
    sendError(res, 'Failed to delete reminder.')
  }
}

// POST /api/notifications/dismiss
export async function dismissNotification(
  req: iAuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const parsed = DismissSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, 'Validation failed.', 400, parsed.error.flatten().fieldErrors)
      return
    }

    await NotificationsService.dismissNotification(
      req.token,
      req.user.business_id,
      req.user.id,
      parsed.data.key,
    )

    // Idempotent — dismissing an already-dismissed key still returns success.
    sendSuccess(res, null, 'Notification dismissed.')
  } catch (err) {
    console.error('[dismissNotification]', err)
    sendError(res, 'Failed to dismiss notification.')
  }
}