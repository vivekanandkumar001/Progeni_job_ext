import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';

/**
 * Get system statistics
 */
export async function getSystemStats(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    const applicationsCol = db.collection('applications');
    const jobsCol = db.collection('jobs');
    const billingCol = db.collection('billing_records');

    // Parallel queries for performance
    const [
      totalUsers,
      totalApplications,
      totalJobs,
      activeUsers,
      totalBilling,
    ] = await Promise.all([
      usersCol.countDocuments({}),
      applicationsCol.countDocuments({}),
      jobsCol.countDocuments({}),
      usersCol.countDocuments({ lastSignInAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      billingCol.countDocuments({}),
    ]);

    const stats = {
      totalUsers,
      totalApplications,
      totalJobs,
      activeUsers24h: activeUsers,
      totalBillingRecords: totalBilling,
      databaseUptime: process.uptime(),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      cpuUsage: process.memoryUsage().heapTotal > 0 ? Math.round((process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) / process.memoryUsage().heapTotal * 100) : 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const auditCol = db.collection('audit_logs');
    
    const page = parseInt((req as any).query.page as string) || 1;
    const limit = parseInt((req as any).query.limit as string) || 50;
    const action = (req as any).query.action as string;
    const userId = (req as any).query.userId as string;

    const filter: any = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;

    const total = await auditCol.countDocuments(filter);
    const logs = await auditCol
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const formattedLogs = logs.map((log: any) => ({
      id: log._id,
      userId: log.userId,
      action: log.action,
      metadata: log.metadata,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
    }));

    res.json({
      success: true,
      data: formattedLogs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}