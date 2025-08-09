import type { ResourceType } from './resource';

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface RequestRecord {
  id: string;
  userId: string;
  resourceId: string;
  resourceType: ResourceType;
  status: RequestStatus;
  justification: string;
  createdAt: string; // ISO
  durationHours?: number | null;
  approvedAt?: string | null;
  expiresAt?: string | null;
  approverId?: string | null;
  approverName?: string | null;
  decisionNote?: string | null;
}

export function isActive(now: Date, r: RequestRecord): boolean {
  if (r.status !== 'approved') return false;
  if (!r.expiresAt) return true;
  return new Date(r.expiresAt) > now;
}

export function isExpiringIn7Days(now: Date, r: RequestRecord): boolean {
  if (!r.expiresAt) return false;
  const exp = new Date(r.expiresAt);
  return exp > now && exp < new Date(now.getTime() + 7 * 24 * 3600 * 1000);
} 