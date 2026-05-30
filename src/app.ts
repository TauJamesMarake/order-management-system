import express, {
  Application,
  Request,
  Response,
  NextFunction,
} from 'express'
import cors        from 'cors'
import helmet      from 'helmet'
import morgan      from 'morgan'
import rateLimit   from 'express-rate-limit'
import { randomUUID } from 'crypto'
import dotenv      from 'dotenv'

dotenv.config()

/* ── Route imports ──────────────────────────────────────────────────────── */
import authRoutes   from './routes/auth.routes'
import orderRoutes  from './routes/orders.routes'
import userRoutes   from './routes/users.routes'
import reportRoutes from './routes/reports.routes'

const app: Application = express()

/* ── Security headers ───────────────────────────────────────────────────── */
app.use(helmet())

/* ── CORS ───────────────────────────────────────────────────────────────── */
app.use(cors({
  origin:         process.env.CLIENT_URL || 'http://localhost:5173',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

/* ── Body parsing ───────────────────────────────────────────────────────── */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/* ── Request correlation ID ─────────────────────────────────────────────── */
/*
 * ── Fix: observability ───────────────────────────────────────────────────
 * Without a per-request identifier, log lines from concurrent users
 * interleave with no way to trace them back to a single request.
 *
 * This middleware:
 *  1. Generates a UUID for every incoming request.
 *  2. Attaches it to req.id so controllers can include it in log calls.
 *  3. Sends it back to the client as X-Request-Id so frontend teams and
 *     support staff can cross-reference their error reports with server logs.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID()
  ;(req as Request & { id: string }).id = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
})

/* ── HTTP request logging (dev only) ────────────────────────────────────── */
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

/* ── Rate limiters ──────────────────────────────────────────────────────── */
/*
 * ── Fix: per-route rate limiting ─────────────────────────────────────────
 * The original code used a single global limiter of 100 req / 15 min.
 * A bot could exhaust that budget on cheap GET /health calls and block
 * legitimate users from logging in or creating orders.
 * The export endpoints were especially dangerous — a single PDF render
 * can take seconds; 100 concurrent exports would lock the process.
 *
 * We now apply:
 *  - A tight limit on auth endpoints to slow brute-force login attacks.
 *  - A very tight limit on export endpoints to prevent CPU/memory abuse.
 *  - A relaxed global fallback for everything else.
 *
 * All limiters use standardHeaders:true so RFC 6585 RateLimit-* headers
 * are sent to the client, and legacyHeaders:false to suppress the older
 * X-RateLimit-* headers.
 */

/** Global fallback — applies to any route not covered by a specific limiter */
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,   /* 15 minutes */
  max:            200,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
})

/** Tight limiter for login — slows brute-force credential stuffing */
const authLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,   /* 15 minutes */
  max:            20,                /* 20 login attempts per IP per window */
  standardHeaders: true,
  legacyHeaders:  false,
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
})

/**
 * Very tight limiter for report exports.
 * Each export loads up to REPORT_ROW_CAP rows and renders a file in memory.
 * Limiting to 10 per 15 minutes per IP prevents CPU / OOM abuse.
 */
const exportLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,   /* 15 minutes */
  max:            10,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { success: false, error: 'Export limit reached. Please try again later.' },
})

app.use(globalLimiter)

/* ── Health check ───────────────────────────────────────────────────────── */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status:    'ok',
      service:   'OMS API',
      timestamp: new Date().toISOString(),
    },
  })
})

/* ── API routes ─────────────────────────────────────────────────────────── */
/*
 * Per-route limiters are mounted before the router so they apply to every
 * handler in that router without requiring individual middleware calls.
 */
app.use('/api/auth',    authLimiter,   authRoutes)
app.use('/api/orders',                 orderRoutes)
app.use('/api/users',                  userRoutes)
app.use('/api/reports',                reportRoutes)

/* Export-specific limiter applied directly to the export sub-paths */
app.use('/api/reports/export', exportLimiter)

/* ── 404 handler ────────────────────────────────────────────────────────── */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found.' })
})

/* ── Global error handler ───────────────────────────────────────────────── */
/*
 * Must declare all four parameters so Express recognises this as error
 * middleware — do not remove _next even though it is unused.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err.message)
  res.status(500).json({ success: false, error: 'Internal server error.' })
})

export default app