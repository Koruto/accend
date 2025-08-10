export type UserRole = 'developer' | 'qa' | 'admin';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  createdAt: string;
} 