import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';

/**
 * Get billing overview
 */
export async function getBillingOverview(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const billingCol = db.collection('billing_records');
    const usersCol = db.collection('users');

    // Total revenue
    const totalRevenue = await billingCol.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    // Revenue by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const monthlyRevenue = await billingCol.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();

    // Users by subscription tier
    const subscriptionTierCounts = await usersCol.aggregate([
      { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } }
    ]).toArray();

    // Recent billing activity
    const recentBilling = await billingCol
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const overview = {
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      monthlyRevenue: monthlyRevenue.map((m: any) => ({
        year: m._id.year,
        month: m._id.month,
        amount: m.amount,
      })),
      subscriptionTiers: subscriptionTierCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      totalBillingRecords: await billingCol.countDocuments({}),
      recentBilling: recentBilling.map(b => ({
        id: b._id,
        userId: b.userId,
        amount: b.amount,
        type: b.type,
        status: b.status,
        createdAt: b.createdAt,
      })),
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
 * Get user billing details
 */
export async function getUserBilling(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.id;
    const db = await getDatabase();
    const billingCol = db.collection('billing_records');
    const usersCol = db.collection('users');

    // User's billing history
    const billingHistory = await billingCol
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // User subscription info
    const user = await usersCol.findOne({ _id: userId });
    
    const history = billingHistory.map(b => ({
      id: b._id,
      amount: b.amount,
      type: b.type,
      status: b.status,
      currency: b.currency,
      createdAt: b.createdAt,
      description: b.description,
    }));

    const analytics = {
      userId,
      subscriptionTier: user?.subscriptionTier,
      currentPlan: user?.currentPlan,
      billingHistory,
      totalSpent: billingHistory.reduce((sum: number, b: any) => sum + b.amount, 0),
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Process refund
 */
export async function processRefund(req: Request, res: Response): Promise<void> {
  try {
    const { userId, amount, reason, referenceId } = req.body;
    
    const db = await getDatabase();
    const billingCol = db.collection('billing_records');
    const usersCol = db.collection('users');
    
    // Create refund record
    const refundRecord = {
      userId,
      amount,
      type: 'refund',
      status: 'processing',
      reason,
      referenceId,
      createdAt: new Date(),
    };
    
    const result = await billingCol.insertOne(refundRecord);
    
    // In a real system, this would trigger a payment processor refund
    // For now, we'll update the status
    await billingCol.updateOne(
      { _id: result.insertedId },
      { $set: { status: 'completed' } }
    );
    
    // Optionally update user's billing summary
    await usersCol.updateOne(
      { _id: userId },
      { $inc: { lifetimeSpent: -amount } }
    );
    
    res.json({
      success: true,
      data: {
        refundId: result.insertedId,
        amount,
        status: 'completed',
        reason,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStats(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');

    // Count users by subscription tier
    const tierCounts = await usersCol.aggregate([
      { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } }
    ]).toArray();

    // Count active vs suspended vs trial
    const statusCounts = await usersCol.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    // Monthly recurring revenue (MRR) calculation
    const mrr = await usersCol.aggregate([
      { $match: { status: 'active', subscriptionTier: 'premium' } },
      { $group: { _id: null, mrr: { $sum: '$monthlyPrice' } } }
    ]).toArray();

    const stats = {
      totalUsers: await usersCol.countDocuments({}),
      tierCounts: tierCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      statusCounts: statusCounts.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      mrr: mrr.length > 0 ? mrr[0].mrr : 0,
      activeUsers: await usersCol.countDocuments({ status: 'active' }),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}