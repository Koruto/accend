import type { UserRole } from '../auth/types';

export type ResourceType =
  | 'deployment_env_lock'
  | 'feature_flag_change'
  | 'db_readonly'
  | 'dwh_dataset_viewer'
  | 'cloud_console_role'
  | 'object_store_write_window'
  | 'k8s_namespace_access'
  | 'secrets_read'
  | 'github_repo_permission'
  | 'cicd_bypass'
  | 'monitoring_edit'
  | 'logging_query';

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