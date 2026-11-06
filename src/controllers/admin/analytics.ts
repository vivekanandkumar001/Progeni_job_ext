import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';

/**
 * Get overall system analytics overview
 */
export async function getAnalyticsOverview(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    const applicationsCol = db.collection('applications');
    const jobsCol = db.collection('jobs');

    // Total users by role
    const userCounts = await usersCol.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]).toArray();

    // Total applications by status
    const applicationCounts = await applicationsCol.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    // Total jobs by status
    const jobCounts = await jobsCol.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    // Recent sign-ups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSignups = await usersCol.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Active users (last 30 days)
    const activeUsers = await usersCol.countDocuments({
      lastSignInAt: { $gte: thirtyDaysAgo },
    });

    const overview = {
      userCounts: userCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      applicationCounts: applicationCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      jobCounts: jobCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      recentSignups,
      activeUsers,
      totalUsers: userCounts.reduce((acc: any, curr: any) => acc + curr.count, 0),
      totalApplications: applicationCounts.reduce((acc: any, curr: any) => acc + curr.count, 0),
      totalJobs: jobCounts.reduce((acc: any, curr: any) => acc + curr.count, 0),
    };

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get specific user analytics
 */
export async function getUserAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.id;
    const db = await getDatabase();
    const usersCol = db.collection('users');
    const applicationsCol = db.collection('applications');

    // User details
    const user = await usersCol.findOne({ _id: userId });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Application history
    const applicationHistory = await applicationsCol
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Convert MongoDB _id to string
    const apps = applicationHistory.map(app => ({
      id: app._id.toString(),
      jobId: app.jobId,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));

    const analytics = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      applicationHistory: apps,
      totalApplications: await applicationsCol.countDocuments({ userId }),
      activeStatus: user.status === 'active',
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get application analytics
 */
export async function getApplicationAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const applicationsCol = db.collection('applications');

    // Application counts by status
    const statusCounts = await applicationsCol.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    // Applications by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyStats = await applicationsCol.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();

    // Conversion funnel
    const totalApplications = await applicationsCol.countDocuments({});
    const submittedCount = await applicationsCol.countDocuments({ status: 'submitted' });
    const interviewCount = await applicationsCol.countDocuments({ status: 'interview' });
    const offerCount = await applicationsCol.countDocuments({ status: 'offer' });

    const conversionFunnel = {
      total: totalApplications,
      submitted: submittedCount,
      interview: interviewCount,
      offer: offerCount,
      submissionRate: totalApplications > 0 ? (submittedCount / totalApplications) * 100 : 0,
      interviewRate: totalApplications > 0 ? (interviewCount / totalApplications) * 100 : 0,
    };

    const result = {
      statusCounts: statusCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      monthlyStats,
      conversionFunnel,
      totalApplications,
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get system-level analytics
 */
export async function getSystemAnalytics(req: Request, response: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    const applicationsCol = db.collection('applications');
    const jobsCol = db.collection('jobs');

    // Total counts
    const totalUsers = await usersCol.countDocuments({});
    const totalApplications = await applicationsCol.countDocuments({});
    const totalJobs = await jobsCol.countDocuments({});

    // Active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers7d = await usersCol.countDocuments({
      lastSignInAt: { $gte: sevenDaysAgo },
    });

    // System uptime and health metrics
    const systemHealth = {
      totalUsers,
      totalApplications,
      totalJobs,
      activeUsers7d,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };

    res.json({
      success: true,
      data: systemHealth,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}