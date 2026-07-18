import express, {
  Application,
  Request,
  Response,
  NextFunction,
} from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

import authRoutes from './routes/auth.routes'
import orderRoutes from './routes/orders.routes'
import userRoutes from './routes/users.routes'
import reportRoutes from './routes/reports.routes'
import platformRoutes from './routes/platform.routes'

const app: Application = express()

app.use(helmet())

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID()
    ; (req as Request & { id: string }).id = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
})

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,   /* 15 minutes */
//   max: 200,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { success: false, error: 'Too many requests. Please try again later.' },
// })

// Rate limiting is disabled in the test environment to prevent the
// in-process supertest suite from exhausting the 100 req/15 min window.
if (process.env.NODE_ENV !== 'test') {
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, error: 'Too many requests. Please try again later.' },
  })
  app.use(globalLimiter)
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 20,                // 20 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
})

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Export limit reached. Please try again later.' },
})

// app.use(globalLimiter)

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'OMS API',
      timestamp: new Date().toISOString(),
    },
  })
})

/* API routes */
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reports/export', exportLimiter)
app.use('/api/reports', reportRoutes)
app.use('/api/platform', platformRoutes)

/* 404 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found.' })
})

/* Global error handler */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err.message)
  res.status(500).json({ success: false, error: 'Internal server error.' })
})

export default app