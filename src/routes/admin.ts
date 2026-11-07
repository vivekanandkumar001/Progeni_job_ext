import { Router } from 'express';
import { requireAdmin, requireSuperAdmin } from '../middlewares/auth.js';
import {
  getAdminConfig,
  updateFeatureStatus,
  updatePricingPlan,
  getUsers,
  getUserById,
  updateUserRole,
  suspendUser,
  reactivateUser,
  deleteUser,
  getAuditLogs,
} from '../controllers/admin/users.js';
import {
  getAnalyticsOverview,
  getUserAnalytics,
  getApplicationAnalytics,
  getSystemAnalytics,
} from '../controllers/admin/analytics.js';
import {
  getAllJobs,
  getJobById,
  updateJobStatus,
  deleteJob,
} from '../controllers/admin/jobs.js';
import {
  getAllAdapters,
  testAdapter,
  refreshAdapterCache,
} from '../controllers/admin/adapters.js';
import {
  getBillingOverview,
  getUserBilling,
  processRefund,
  getSubscriptionStats,
} from '../controllers/admin/billing.js';
import { getSystemStats } from '../controllers/admin/system.js';

const router = Router();

// ==================== ADMIN CONFIGURATION ====================

/**
 * GET /api/v1/admin/config
 * Get full admin configuration including features and pricing
 * Access: admin, super_admin
 */
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await getAdminConfig(req.userId);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v1/admin/config/features
 * Toggle feature enabled/disabled
 * Access: admin (some features), super_admin (all)
 */
router.patch('/config/features', requireAdmin, async (req, res) => {
  try {
    const result = await updateFeatureStatus(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  });
});

/**
 * PATCH /api/v1/admin/config/plan
 * Update subscription plan
 * Access: super_admin only
 */
router.patch('/config/plan', requireSuperAdmin, async (req, res) => {
  try {
    const { planName } = req.body;
    if (!planName) {
      return res.status(400).json({ error: 'Plan name is required' });
    }
    const result = await updatePricingPlan(planName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USER MANAGEMENT ====================

/**
 * GET /api/v1/admin/users
 * Get all users with pagination and filtering
 * Access: admin, super_admin
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const role = req.query.role as string;
    const status = req.query.status as string;

    const result = await getUsers({ page, limit, role, status });
    res.json({
      success: true,
      data: result.users,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/users/:id
 * Get single user details
 * Access: admin, super_admin
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v1/admin/users/:id/role
 * Update user role
 * Access: super_admin only
 */
router.patch('/users/:id/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    const user = await updateUserRole(req.params.id, role);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/users/:id/suspend
 * Suspend user account
 * Access: super_admin only
 */
router.post('/users/:id/suspend', requireSuperAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await suspendUser(req.params.id, reason);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/users/:id/reactivate
 * Reactivate suspended user
 * Access: super_admin only
 */
router.post('/users/:id/reactivate', requireSuperAdmin, async (req, res) => {
  try {
    const user = await reactivateUser(req.params.id);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/admin/users/:id
 * Delete user account (soft delete)
 * Access: super_admin only
 */
router.delete('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const result = await deleteUser(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/v1/admin/analytics/overview
 * Get overall system analytics
 * Access: admin, super_admin
 */
router.get('/analytics/overview', requireAdmin, async (req, res) => {
  try {
    const analytics = await getAnalyticsOverview(req);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/analytics/users/:id
 * Get specific user analytics
 * Access: admin, super_admin
 */
router.get('/analytics/users/:id', requireAdmin, async (req, res) => {
  try {
    const analytics = await getUserAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/analytics/applications
 * Get application analytics
 * Access: admin, super_admin
 */
router.get('/analytics/applications', requireAdmin, async (req, res) => {
  try {
    const analytics = await getApplicationAnalytics(req);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/analytics/system
 * Get system-level analytics
 * Access: admin, super_admin
 */
router.get('/analytics/system', requireAdmin, async (req, res) => {
  try {
    const analytics = await getSystemAnalytics(req);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== JOB MANAGEMENT ====================

/**
 * GET /api/v1/admin/jobs
 * Get all jobs with filtering
 * Access: admin, super_admin
 */
router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    const result = await getAllJobs(req, res);
    // Can't easily pass req/res through router, so simplify
    // In production, would use proper request handling
    res.status(500).json({ error: 'Use dedicated endpoint' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simplified job routes
router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    const result = await getAllJobs({ page, limit, status });
    res.json({
      success: true,
      data: result.jobs,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  });
});

router.patch('/jobs/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const updatedJob = await updateJobStatus(req.params.id, status);
    res.json({ success: true, data: updatedJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/jobs/:id', requireSuperAdmin, async (req, res) => {
  try {
    await deleteJob(req.params.id);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADAPTER MANAGEMENT ====================

router.get('/adapters', requireAdmin, async (req, res) => {
  try {
    const adapters = await getAllAdapters();
    res.json({ success: true, data: adapters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/adapters/:id/test', requireAdmin, async (req, res) => {
  try {
    const result = await testAdapter(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/adapters/refresh', requireAdmin, async (req, res) => {
  try {
    await refreshAdapterCache();
    res.json({ success: true, message: 'Adapter cache refreshed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BILLING & SUBSCRIPTIONS ====================

router.get('/billing/overview', requireAdmin, async (req, res) => {
  try {
    const overview = await getBillingOverview(req);
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/billing/users/:id', requireAdmin, async (req, res) => {
  try {
    const billing = await getUserBilling(req.params.id);
    res.json({ success: true, data: billing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/billing/refunds', requireSuperAdmin, async (req, res) => {
  try {
    const result = await processRefund(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/billing/subscriptions/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getSubscriptionStats(req);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SYSTEM ADMINISTRATION ====================

router.get('/system/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getSystemStats(req);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const logs = await getAuditLogs(req);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;