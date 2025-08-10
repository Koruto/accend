export type UserRole = 'developer' | 'qa' | 'admin';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessLevel: number;
} 