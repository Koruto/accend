import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PublicUser, UserRecord, UserRole } from './types';

const usersByEmail = new Map<string, UserRecord>();

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<PublicUser> {
  const { name, email, password, role } = params;
  if (usersByEmail.has(email.toLowerCase())) {
    throw new Error('EMAIL_EXISTS');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const record: UserRecord = {
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  usersByEmail.set(record.email, record);
  return toPublic(record);
}

export async function verifyUser(email: string, password: string): Promise<PublicUser | null> {
  const record = usersByEmail.get(email.toLowerCase());
  if (!record) return null;
  const ok = await bcrypt.compare(password, record.passwordHash);
  if (!ok) return null;
  return toPublic(record);
}

export function getUserByEmail(email: string): PublicUser | null {
  const record = usersByEmail.get(email.toLowerCase());
  return record ? toPublic(record) : null;
}

function toPublic(record: UserRecord): PublicUser {
  const { id, name, email, role } = record;
  return { id, name, email, role };
} 