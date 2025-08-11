import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getCollection } from '../store/mongo.js';
import { PublicUser, UserRecord, UserRole } from './types.js';

function toPublic(record: UserRecord): PublicUser {
  const { id, name, email, role, accessLevel } = record;
  return { id, name, email, role, accessLevel };
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<PublicUser> {
  const { name, email, password, role } = params;
  const col = getCollection<UserRecord>('users');
  const existing = await col.findOne({ email: email.toLowerCase() });
  if (existing) throw new Error('EMAIL_EXISTS');
  const passwordHash = await bcrypt.hash(password, 10);
  const record: UserRecord = {
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    role,
    accessLevel: 3,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await col.insertOne(record);
  return toPublic(record);
}

export async function verifyUser(email: string, password: string): Promise<PublicUser | null> {
  const col = getCollection<UserRecord>('users');
  const record = await col.findOne({ email: email.toLowerCase() });
  if (!record) return null;
  const ok = await bcrypt.compare(password, record.passwordHash);
  if (!ok) return null;
  return toPublic(record);
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const col = getCollection<UserRecord>('users');
  const record = await col.findOne({ email: email.toLowerCase() });
  return record ? toPublic(record) : null;
}

export async function getUserPublicById(id: string): Promise<PublicUser | null> {
  const col = getCollection<UserRecord>('users');
  const record = await col.findOne({ id });
  return record ? toPublic(record) : null;
}

export async function updateUserName(id: string, name: string): Promise<PublicUser> {
  const col = getCollection<UserRecord>('users');
  const res = await col.findOneAndUpdate({ id }, { $set: { name } }, { returnDocument: 'after' });
  const next = (res as any)?.value ?? null;
  if (!next) throw new Error('USER_NOT_FOUND');
  return toPublic(next as UserRecord);
} 