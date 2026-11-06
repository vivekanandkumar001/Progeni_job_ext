import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';
import { authAuditService } from '../../services/authAuditService.js';

export interface UserListResult {
  users: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    lastSignInAt: string;
    createdAt: string;
  }>;
  total: number;
}

export interface UserDetail {
  id: string;
  email: string;
  role: string;
  status: string;
  tokenVersion: number;
  mfaEnabled: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

/**
 * Get all users with pagination and filtering
 */
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt((req as any).query.page as string) || 1;
    const limit = parseInt((req as any).query.limit as string) || 50;
    const role = (req as any).query.role as string;
    const status = (req as any).query.status as string;

    const db = await getDatabase();
    const usersCol = db.collection('users');
    
    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const total = await usersCol.countDocuments(filter);
    const users = await usersCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .project({
        id: { $toString: '$_id' },
        email: 1,
        role: 1,
        status: 1,
        lastSignInAt: 1,
        createdAt: 1,
      })
      .toArray();

    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        lastSignInAt: u.lastSignInAt,
        createdAt: u.createdAt,
      })),
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single user details
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ _id: req.params.id });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        tokenVersion: user.token_version,
        mfaEnabled: user.mfa_enabled,
        lastSignInAt: user.last_sign_in_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastActiveAt: null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update user role
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;
    const db = await getDatabase();
    const usersCol = db.collection('users');
    
    const result = await usersCol.updateOne(
      { _id: req.params.id },
      { $set: { role: role, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const updatedUser = await usersCol.findOne({ _id: req.params.id });
    res.json({
      success: true,
      data: {
        id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Suspend user account
 */
export async function suspendUser(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = req.body;
    const db = await getDatabase();
    const usersCol = db.collection('users');
    
    // Log the suspension event
    await authAuditService.logEvent({
      userId: req.params.id,
      action: 'user_suspended',
      metadata: { reason },
    });
    
    const result = await usersCol.updateOne(
      { _id: req.params.id },
      { 
        $set: { status: 'suspended', suspendedAt: new Date() },
        $unset: { lastSignInAt: '' }
      }
    );
    
    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const updatedUser = await usersCol.findOne({ _id: req.params.id });
    res.json({
      success: true,
      data: {
        id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: 'suspended',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Reactivate suspended user
 */
export async function reactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    
    // Log the reactivation event
    await authAuditService.logEvent({
      userId: req.params.id,
      action: 'user_reactivated',
    });
    
    const result = await usersCol.updateOne(
      { _id: req.params.id },
      { 
        $set: { status: 'active', updatedAt: new Date() },
        $unset: { suspendedAt: '' }
      }
    );
    
    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const updatedUser = await usersCol.findOne({ _id: req.params.id });
    res.json({
      success: true,
      data: {
        id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: 'active',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete user account (soft delete)
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const usersCol = db.collection('users');
    
    // Log the deletion event
    await authAuditService.logEvent({
      userId: req.params.id,
      action: 'user_deleted',
    });
    
    const result = await usersCol.updateOne(
      { _id: req.params.id },
      { 
        $set: { status: 'deleted', deletedAt: new Date() },
        $unset: { lastSignInAt: '' }
      }
    );
    
    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      data: { message: 'User account permanently deleted' },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}