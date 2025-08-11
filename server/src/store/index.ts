import { randomUUID } from 'node:crypto';
import type { ResourceRecord } from '../models/resource';
import type { RequestRecord } from '../models/request';

export const resources: ResourceRecord[] = [
  {
    id: 'res_staging_lock',
    name: 'Staging Environment Lock',
    type: 'deployment_env_lock',
    riskLevel: 'medium',
    approverRole: 'admin',
    tags: ['deploy', 'staging'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { environment: 'staging', allowedDurationHours: [1, 2, 4, 8], maxDurationHours: 8 },
  },
  {
    id: 'res_test_run',
    name: 'Automated Test Run',
    type: 'test_run_request',
    riskLevel: 'low',
    approverRole: 'admin',
    tags: ['tests'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { suites: ['smoke', 'regression'] },
  },
];

export const requestsByUserId = new Map<string, RequestRecord[]>();

export function seedRequestsForUser(userId: string) {
  if (requestsByUserId.has(userId)) return;
  const now = new Date();
  const sample: RequestRecord[] = [
    {
      id: randomUUID(),
      userId,
      resourceId: 'res_staging_lock',
      resourceType: 'deployment_env_lock',
      status: 'approved',
      justification: 'E2E test window for sprint-42',
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
      durationHours: 2,
      approvedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 2 * 3600 * 1000).toISOString(),
      approverId: 'admin_1',
      approverName: 'Admin User',
      decisionNote: 'Approved for QA window',
    },
  ];
  requestsByUserId.set(userId, sample);
} 