import { Router } from 'express';
import {
  getBillingOverview,
  getUsageAnalytics,
  listSubscriptions,
  adminCancelSubscription,
  listTransactions,
  issueRefund,
  adjustCredits,
  getAbuseMonitoring,
  getSystemHealth,
  listAuditLogs,
} from '../controllers/adminBilling.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = Router();

// Enforce admin/super_admin/support authentication
router.use(authMiddleware, requireRole('admin', 'super_admin', 'support'));

router.get('/overview', getBillingOverview);
router.get('/usage-analytics', getUsageAnalytics);
router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions/:candidateId/cancel', requireRole('admin', 'super_admin'), adminCancelSubscription);
router.get('/transactions', listTransactions);
router.post('/transactions/:transactionId/refund', requireRole('admin', 'super_admin'), issueRefund);
router.post('/credits/adjust', requireRole('admin', 'super_admin'), adjustCredits);
router.get('/abuse-monitoring', getAbuseMonitoring);
router.get('/system-health', getSystemHealth);
router.get('/audit-logs', listAuditLogs);

export default router;

