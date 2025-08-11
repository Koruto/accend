import type { ResourceType } from './resource.js';

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
  bookingId?: string | null;
} 