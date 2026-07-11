import { Router, RequestHandler } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import * as AuthController from '../controllers/auth.controller'

const router = Router()

// Public
router.post('/login', AuthController.login)
router.post('/reset-password', AuthController.requestPasswordReset)

// Protected
router.post('/logout', verifyToken as RequestHandler, AuthController.logout)
router.get('/me', verifyToken as RequestHandler, AuthController.getMe)

export default router