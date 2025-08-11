import type { UserRole } from '../auth/types';

export type ResourceType =
  | 'deployment_env_lock'
  | 'test_run_request';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ResourceRecord {
  id: string;
  name: string;
  type: ResourceType;
  riskLevel: RiskLevel;
  approverRole: UserRole; // who approves
  tags: string[];
  allowedRequesterRoles?: UserRole[]; // visibility filter; admin bypasses
  // type-specific optional details kept for future use
  details?: Record<string, unknown>;
} 