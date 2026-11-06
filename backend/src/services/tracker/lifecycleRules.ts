import type { ApplicationLifecycleStatus } from './types.js';
import { LIFECYCLE_TRANSITIONS } from '../applicationEngine.js';

export class LifecycleRules {
  /**
   * Checks if a transition from currentStatus to targetStatus is permitted.
   */
  canTransition(currentStatus: string, targetStatus: string): boolean {
    if (currentStatus === targetStatus) return true;
    const allowed = LIFECYCLE_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Asserts that transition is valid, throwing descriptive error if rejected.
   */
  assertValidTransition(currentStatus: string, targetStatus: string): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new Error(
        `Invalid status transition: Cannot transition application from '${currentStatus}' to '${targetStatus}'. Allowed target states: [${(LIFECYCLE_TRANSITIONS[currentStatus] || []).join(', ')}]`,
      );
    }
  }

  /**
   * Returns all allowed next states for a given status.
   */
  getAllowedTransitions(currentStatus: string): string[] {
    return LIFECYCLE_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Checks whether a status is terminal (no further transitions permitted).
   */
  isTerminal(status: string): boolean {
    const allowed = LIFECYCLE_TRANSITIONS[status] || [];
    return allowed.length === 0;
  }
}

export const lifecycleRules = new LifecycleRules();

