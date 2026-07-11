import { Router, RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { verifyPlatformToken } from '../middleware/auth.middleware'
import * as PlatformController from '../controllers/platform.controller'

const router = Router()

const platformLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many login attempts. Please try again later.' },
})

// Public
router.post(
    '/auth/login',
    platformLoginLimiter,
    PlatformController.login as RequestHandler,
)

// Platform operator (superadmin) only
router.get(
    '/businesses',
    verifyPlatformToken as RequestHandler,
    PlatformController.getBusinesses as RequestHandler,
)

router.get(
    '/businesses/:id',
    verifyPlatformToken as RequestHandler,
    PlatformController.getBusinessById as RequestHandler,
)

router.patch(
    '/businesses/:id/suspend',
    verifyPlatformToken as RequestHandler,
    PlatformController.suspendBusiness as RequestHandler,
)

router.patch(
    '/businesses/:id/reactivate',
    verifyPlatformToken as RequestHandler,
    PlatformController.reactivateBusiness as RequestHandler,
)

export default router