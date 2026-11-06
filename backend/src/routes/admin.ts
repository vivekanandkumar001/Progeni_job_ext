import { Router } from 'express';
import { requireAdmin, requireSuperAdmin } from '../middlewares/auth.js';
import {
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
    const role = req.query.role as 'candidate' | 'premium_candidate' | 'support' | 'admin' | 'super_admin';
    const status = req.query.status as 'active' | 'suspended' | 'deleted';

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
};

// ==================== ANALYTICS & REPORTING ====================

/**
 * GET /api/v1/admin/analytics/overview
 * Get overall system analytics
 * Access: admin, super_admin
 */
router.get('/analytics/overview', requireAdmin, async (req, res) => {
  try {
    const analytics = await getAnalyticsOverview();
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
    const analytics = await getApplicationAnalytics();
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
    const analytics = await getSystemAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
    const status = req.query.status as 'discovered' | 'prepared' | 'submitted' | 'interview' | 'rejected' | 'withdrawn' | undefined;

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

/**
 * GET /api/v1/admin/jobs/:id
 * Get single job details
 * Access: admin, super_admin
 */
router.get('/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v1/admin/jobs/:id/status
 * Update job status
 * Access: admin, super_admin
 */
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

/**
 * DELETE /api/v1/admin/jobs/:id
 * Delete job (remove from system)
 * Access: super_admin only
 */
router.delete('/jobs/:id', requireSuperAdmin, async (req, res) => {
  try {
    await deleteJob(req.params.id);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADAPTER MANAGEMENT ====================

/**
 * GET /api/v1/admin/adapters
 * Get all adapter configurations
 * Access: admin, super_admin
 */
router.get('/adapters', requireAdmin, async (req, res) => {
  try {
    const adapters = await getAllAdapters();
    res.json({ success: true, data: adapters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/adapters/:id/test
 * Test adapter functionality
 * Access: admin, super_admin
 */
router.post('/adapters/:id/test', requireAdmin, async (req, res) => {
  try {
    const result = await testAdapter(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/adapters/refresh
 * Refresh adapter cache
 * Access: admin, super_admin
 */
router.post('/adapters/refresh', requireAdmin, async (req, res) => {
  try {
    await refreshAdapterCache();
    res.json({ success: true, message: 'Adapter cache refreshed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BILLING & SUBSCRIPTIONS ====================

/**
 * GET /api/v1/admin/billing/overview
 * Get billing overview
 * Access: admin, super_admin
 */
router.get('/billing/overview', requireAdmin, async (req, res) => {
  try {
    const overview = await getBillingOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/billing/users/:id
 * Get user billing details
 * Access: admin, super_admin
 */
router.get('/billing/users/:id', requireAdmin, async (req, res) => {
  try {
    const billing = await getUserBilling(req.params.id);
    res.json({ success: true, data: billing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/billing/refunds
 * Process refund
 * Access: super_admin only
 */
router.post('/billing/refunds', requireSuperAdmin, async (req, res) => {
  try {
    const result = await processRefund(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/billing/subscriptions/stats
 * Get subscription statistics
 * Access: admin, super_admin
 */
router.get('/billing/subscriptions/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getSubscriptionStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SYSTEM ADMINISTRATION ====================

/**
 * GET /api/v1/admin/system/stats
 * Get system statistics
 * Access: admin, super_admin
 */
router.get('/system/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUDIT LOGS ====================

/**
 * GET /api/v1/admin/audit-logs
 * Get audit logs with filtering
 * Access: admin, super_admin
 */
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const userId = req.query.userId as string;

    const result = await getAuditLogs({ page, limit, action, userId });
    res.json({
      success: true,
      data: result.logs,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;