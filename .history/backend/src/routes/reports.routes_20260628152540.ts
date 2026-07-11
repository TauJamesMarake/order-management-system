import { Router } from 'express'
import { verifyToken } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import * as ReportsController from '../controllers/reports.controller'

const router = Router()

router.get('/summary',      verifyToken, requireRole('admin'), ReportsController.getSummary)
router.get('/export/excel', verifyToken, requireRole('admin'), ReportsController.exportExcel)
router.get('/export/pdf',   verifyToken, requireRole('admin'), ReportsController.exportPdf)

export default router