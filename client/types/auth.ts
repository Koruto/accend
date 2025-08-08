export type UserRole = 'manager' | 'approver';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
} 