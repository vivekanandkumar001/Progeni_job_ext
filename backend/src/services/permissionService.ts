import type { UserRole } from './userAccountService.js';

export type Permission =
  // Candidate Permissions
  | 'candidate.profile.read'
  | 'candidate.profile.update'
  | 'candidate.resume.read'
  | 'candidate.resume.upload'
  | 'candidate.resume.update'
  | 'candidate.resume.delete'
  | 'candidate.resume.export'
  | 'candidate.job.read'
  | 'candidate.job.save'
  | 'candidate.job.import'
  | 'candidate.match.read'
  | 'candidate.application.read'
  | 'candidate.application.create'
  | 'candidate.application.update'
  | 'candidate.application.delete'
  | 'candidate.data.export'
  | 'candidate.account.delete'
  | 'candidate.extension.pair'
  | 'candidate.billing.read'
  | 'candidate.billing.manage'
  // Premium Candidate Permissions
  | 'candidate.interview.deep_simulation'
  | 'candidate.priority_matching'
  // Administrative & Support Permissions
  | 'admin.users.read'
  | 'admin.users.suspend'
  | 'admin.users.reactivate'
  | 'admin.jobs.manage'
  | 'admin.adapters.manage'
  | 'admin.audit.read'
  | 'admin.analytics.read'
  | 'admin.billing.read'
  | 'admin.billing.manage'
  | 'admin.subscriptions.read'
  | 'admin.subscriptions.manage'
  | 'admin.refunds.manage'
  // Super Admin Permissions
  | 'system.roles.manage'
  | 'system.permissions.manage'
  | 'system.security.configure'
  | 'system.audit.purge';

const CANDIDATE_BASE_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'candidate.profile.read',
  'candidate.profile.update',
  'candidate.resume.read',
  'candidate.resume.upload',
  'candidate.resume.update',
  'candidate.resume.delete',
  'candidate.resume.export',
  'candidate.job.read',
  'candidate.job.save',
  'candidate.job.import',
  'candidate.match.read',
  'candidate.application.read',
  'candidate.application.create',
  'candidate.application.update',
  'candidate.application.delete',
  'candidate.data.export',
  'candidate.account.delete',
  'candidate.extension.pair',
  'candidate.billing.read',
  'candidate.billing.manage',
]);

const PREMIUM_CANDIDATE_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...CANDIDATE_BASE_PERMISSIONS,
  'candidate.interview.deep_simulation',
  'candidate.priority_matching',
]);

const SUPPORT_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'candidate.profile.read',
  'candidate.job.read',
  'candidate.resume.read',
  'candidate.application.read',
  'candidate.match.read',
  'admin.users.read',
  'admin.audit.read',
  'admin.analytics.read',
  'admin.billing.read',
  'admin.subscriptions.read',
]);

const ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...SUPPORT_PERMISSIONS,
  'admin.users.suspend',
  'admin.users.reactivate',
  'admin.jobs.manage',
  'admin.adapters.manage',
  'admin.billing.manage',
  'admin.subscriptions.manage',
  'admin.refunds.manage',
]);

const SUPER_ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...ADMIN_PERMISSIONS,
  ...PREMIUM_CANDIDATE_PERMISSIONS,
  'system.roles.manage',
  'system.permissions.manage',
  'system.security.configure',
  'system.audit.purge',
]);

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  candidate: CANDIDATE_BASE_PERMISSIONS,
  premium_candidate: PREMIUM_CANDIDATE_PERMISSIONS,
  support: SUPPORT_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  super_admin: SUPER_ADMIN_PERMISSIONS,
};

export class PermissionService {
  /**
   * Evaluates whether a role possesses a specific permission.
   * Defaults to false (deny-by-default).
   */
  hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role];
    return permissions ? permissions.has(permission) : false;
  }

  /**
   * Evaluates whether a role possesses all specified permissions.
   */
  hasAllPermissions(role: UserRole | undefined | null, permissions: Permission[]): boolean {
    if (!role || permissions.length === 0) return false;
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    return permissions.every((p) => rolePerms.has(p));
  }

  /**
   * Evaluates whether a role possesses at least one of the specified permissions.
   */
  hasAnyPermission(role: UserRole | undefined | null, permissions: Permission[]): boolean {
    if (!role || permissions.length === 0) return false;
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    return permissions.some((p) => rolePerms.has(p));
  }

  /**
   * Returns list of all granted permissions for a given role.
   */
  getPermissionsForRole(role: UserRole | undefined | null): Permission[] {
    if (!role) return [];
    const permissions = ROLE_PERMISSIONS[role];
    return permissions ? Array.from(permissions) : [];
  }
}

export const permissionService = new PermissionService();

