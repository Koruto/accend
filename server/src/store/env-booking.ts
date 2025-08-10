import { randomUUID } from 'node:crypto';
import type { EnvironmentRecord } from '../models/environment';
import type { BookingRecord } from '../models/booking';

export const environments: EnvironmentRecord[] = [
  { id: 'env_staging', name: 'Staging', bufferMinutes: 10 },
  { id: 'env_test', name: 'Test', bufferMinutes: 10 },
];

export const bookingsByEnvId = new Map<string, BookingRecord[]>();

function isActive(b: BookingRecord, now: Date): boolean {
  if (b.status !== 'approved' && b.status !== 'active') return false;
  if (!b.startedAt || !b.endsAt) return false;
  return new Date(b.startedAt) <= now && now < new Date(b.endsAt);
}

export function getActiveBookingForEnv(envId: string, now = new Date()): BookingRecord | null {
  const list = bookingsByEnvId.get(envId) ?? [];
  const active = list.find((b) => isActive(b, now));
  return active ?? null;
}

export function getUserActiveBooking(userId: string, now = new Date()): BookingRecord | null {
  for (const [, list] of bookingsByEnvId) {
    const active = list.find((b) => b.userId === userId && isActive(b, now));
    if (active) return active;
  }
  return null;
}

export function nextFreeAt(envId: string, now = new Date()): Date | null {
  const env = environments.find((e) => e.id === envId);
  if (!env) return null;
  const active = getActiveBookingForEnv(envId, now);
  if (!active || !active.endsAt) return now;
  return new Date(new Date(active.endsAt).getTime() + env.bufferMinutes * 60 * 1000);
}

export function createImmediateBooking(params: {
  envId: string;
  userId: string;
  justification: string;
  durationMinutes: number;
}): BookingRecord {
  const { envId, userId, justification, durationMinutes } = params;
  const env = environments.find((e) => e.id === envId);
  if (!env) throw new Error('ENV_NOT_FOUND');

  const now = new Date();

  // Enforce single active booking per user across all environments
  if (getUserActiveBooking(userId, now)) {
    throw new Error('USER_ALREADY_HAS_ACTIVE_BOOKING');
  }

  // Disallow if environment is in-use or within buffer window
  const freeAt = nextFreeAt(envId, now);
  if (!freeAt || freeAt > now) {
    const ts = freeAt?.toISOString() ?? '';
    const err: any = new Error('ENV_NOT_FREE');
    err.freeAt = ts;
    throw err;
  }

  const startedAt = now.toISOString();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  const record: BookingRecord = {
    id: randomUUID(),
    envId,
    userId,
    status: 'approved',
    createdAt: now.toISOString(),
    justification,
    startedAt,
    endsAt,
    durationMinutes,
    extensionMinutesTotal: 0,
  };

  const list = bookingsByEnvId.get(envId) ?? [];
  list.unshift(record);
  bookingsByEnvId.set(envId, list);
  return record;
} 