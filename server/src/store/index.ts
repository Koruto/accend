import { randomUUID } from 'node:crypto';
import type { ResourceRecord } from '../models/resource';
import type { RequestRecord } from '../models/request';

export const resources: ResourceRecord[] = [
  {
    id: 'res_deploy_prod',
    name: 'Prod Deploys',
    type: 'deployment_env_lock',
    riskLevel: 'high',
    approverRole: 'manager',
    tags: ['deploy', 'prod'],
    details: { environment: 'prod', allowedDurationHours: [1, 2, 4, 8], maxDurationHours: 8 },
  },
  {
    id: 'res_ld_feature_toggle',
    name: 'LD: Feature Toggle',
    type: 'feature_flag_change',
    riskLevel: 'medium',
    approverRole: 'manager',
    tags: ['flags', 'prod'],
    details: { projectKey: 'web-app', environmentKey: 'production', flagKey: 'feature-x', actionsAllowed: ['enable', 'disable', 'targeting'] },
  },
  {
    id: 'res_db_ro_prod',
    name: 'DB Readonly — Prod Replica',
    type: 'db_readonly',
    riskLevel: 'high',
    approverRole: 'manager',
    tags: ['db', 'postgres'],
    details: { engine: 'postgres', dbName: 'app_prod' },
  },
  {
    id: 'res_aws_readonly',
    name: 'AWS Console — ReadOnlyAccess',
    type: 'cloud_console_role',
    riskLevel: 'medium',
    approverRole: 'manager',
    tags: ['aws', 'console'],
    details: { provider: 'aws', roleArnOrName: 'ReadOnlyAccess' },
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
      resourceId: 'res_deploy_prod',
      resourceType: 'deployment_env_lock',
      status: 'approved',
      justification: 'Mitigate incident INC-4321',
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
      durationHours: 2,
      approvedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 2 * 3600 * 1000).toISOString(),
      approverId: 'm_1',
      approverName: 'Alex Morgan',
      decisionNote: 'Lock approved for incident',
    },
    {
      id: randomUUID(),
      userId,
      resourceId: 'res_db_ro_prod',
      resourceType: 'db_readonly',
      status: 'pending',
      justification: 'Investigate slow query',
      createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
      durationHours: 8,
    },
  ];
  requestsByUserId.set(userId, sample);
} 