import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { notificationService } from '../services/tracker/notificationService.js';

export async function listNotifications(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await notificationService.listNotifications(candidateId, unreadOnly);
    res.json({ ok: true, notifications });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const success = await notificationService.markAsRead(candidateId, req.params.id);

    if (!success) {
      res.status(404).json({ ok: false, error: 'Notification not found' });
      return;
    }

    res.json({ ok: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const count = await notificationService.markAllAsRead(candidateId);
    res.json({ ok: true, modifiedCount: count });
  } catch (error) {
    next(error);
  }
}

