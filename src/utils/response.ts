import { Response } from 'express'
import { iApiSuccess, iApiError } from '../types'

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response {
  const body: iApiSuccess<T> = { success: true, data, ...(message && { message }) }
  return res.status(statusCode).json(body)
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500,
  details?: Record<string, unknown> | unknown[]
): Response {
  const body: iApiError = { success: false, error, ...(details && { details }) }
  return res.status(statusCode).json(body)
}
