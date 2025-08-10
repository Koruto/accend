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
    id: 'res_flag_toggle',
    name: 'Feature Flag Toggle',
    type: 'feature_flag_change',
    riskLevel: 'medium',
    approverRole: 'admin',
    tags: ['flags'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { projectKey: 'web-app', environmentKey: 'staging', flagKey: 'feature-x', actionsAllowed: ['enable', 'disable', 'targeting'] },
  },
  {
    id: 'res_logs_ro',
    name: 'Logs Read-only — service:api (staging)',
    type: 'logging_query',
    riskLevel: 'low',
    approverRole: 'admin',
    tags: ['logs', 'staging'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { system: 'datadog', scope: 'service:api,env:staging' },
  },
  {
    id: 'res_db_ro_staging',
    name: 'DB Readonly — Staging Replica',
    type: 'db_readonly',
    riskLevel: 'medium',
    approverRole: 'admin',
    tags: ['db', 'staging'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { engine: 'postgres', dbName: 'app_staging' },
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
  {
    id: 'res_staging_build',
    name: 'Staging Redeploy',
    type: 'staging_build_request',
    riskLevel: 'medium',
    approverRole: 'admin',
    tags: ['deploy', 'staging'],
    allowedRequesterRoles: ['developer', 'qa'],
    details: { target: 'staging' },
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
    {
      id: randomUUID(),
      userId,
      resourceId: 'res_logs_ro',
      resourceType: 'logging_query',
      status: 'pending',
      justification: 'Investigate intermittent 5xx in staging',
      createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
      durationHours: 4,
    },
  ];
  requestsByUserId.set(userId, sample);
} 