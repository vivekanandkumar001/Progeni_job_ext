import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env, isLocalDevelopment } from '../config/env.js';
import { getSupabaseAuthClient } from '../config/supabase/client.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'candidate' | 'admin';
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (isLocalDevelopment) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string;
        role: 'candidate' | 'admin';
      };
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
    return;
  }

  try {
    const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    req.userId = data.user.id;
    req.userRole = data.user.app_metadata?.role === 'admin' ? 'admin' : 'candidate';
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role: 'candidate' | 'admin') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.userRole !== role) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}