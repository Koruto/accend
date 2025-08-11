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
  if (!requestsByUserId.has(userId)) {
    requestsByUserId.set(userId, []);
  }
} 