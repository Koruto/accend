import { randomUUID } from 'node:crypto';
import type { EnvironmentRecord } from '../models/environment';
import type { BookingRecord } from '../models/booking';

export const environments: EnvironmentRecord[] = [
  { id: 'env_dev', name: 'Development', accessLevelRequired: 1 },
  { id: 'env_test', name: 'Test', accessLevelRequired: 2 },
  { id: 'env_staging', name: 'Staging', accessLevelRequired: 3 },
  { id: 'env_uat', name: 'UAT', accessLevelRequired: 4 },
];

export const bookingsByEnvId = new Map<string, BookingRecord[]>();

export const bookingIdToRequestId = new Map<string, string>();

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

export function getLatestBookingForEnv(envId: string): BookingRecord | null {
  const list = bookingsByEnvId.get(envId) ?? [];
  return list.length > 0 ? list[0] : null;
}

export function getUserActiveBooking(userId: string, now = new Date()): BookingRecord | null {
  for (const [, list] of bookingsByEnvId) {
    const active = list.find((b) => b.userId === userId && isActive(b, now));
    if (active) return active;
  }
  return null;
}

export function nextFreeAt(envId: string, now = new Date()): Date | null {
  const active = getActiveBookingForEnv(envId, now);
  if (active && active.endsAt) {
    return new Date(active.endsAt);
  }
  return now;
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

  if (getUserActiveBooking(userId, now)) {
    throw new Error('USER_ALREADY_HAS_ACTIVE_BOOKING');
  }

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

function findBookingById(bookingId: string): { envId: string; list: BookingRecord[]; index: number; booking: BookingRecord } | null {
  for (const [envId, list] of bookingsByEnvId) {
    const index = list.findIndex((b) => b.id === bookingId);
    if (index >= 0) return { envId, list, index, booking: list[index] };
  }
  return null;
}

export function extendBookingForUser(params: { bookingId: string; userId: string; addMinutes: number; isAdmin: boolean }): BookingRecord {
  const { bookingId, userId, addMinutes, isAdmin } = params;
  if (addMinutes <= 0) throw new Error('INVALID_EXTENSION');
  const found = findBookingById(bookingId);
  if (!found) throw new Error('BOOKING_NOT_FOUND');
  const { list, index, booking } = found;
  if (!isAdmin && booking.userId !== userId) throw new Error('FORBIDDEN');
  if (!booking.startedAt || !booking.endsAt) throw new Error('NOT_ACTIVE');
  const now = new Date();
  if (!(new Date(booking.startedAt) <= now && now < new Date(booking.endsAt))) throw new Error('NOT_ACTIVE');
  const total = (booking.extensionMinutesTotal ?? 0) + addMinutes;
  if (total > 60) throw new Error('EXTENSION_LIMIT_EXCEEDED');
  const newEnds = new Date(new Date(booking.endsAt).getTime() + addMinutes * 60 * 1000).toISOString();
  const updated: BookingRecord = { ...booking, endsAt: newEnds, extensionMinutesTotal: total };
  list[index] = updated;
  return updated;
}

export function releaseBookingForUser(params: { bookingId: string; userId: string; isAdmin: boolean }): BookingRecord {
  const { bookingId, userId, isAdmin } = params;
  const found = findBookingById(bookingId);
  if (!found) throw new Error('BOOKING_NOT_FOUND');
  const { list, index, booking } = found;
  if (!isAdmin && booking.userId !== userId) throw new Error('FORBIDDEN');
  const nowIso = new Date().toISOString();
  const updated: BookingRecord = {
    ...booking,
    status: 'released',
    releasedAt: nowIso,
    closedReason: 'released',
    endsAt: nowIso,
  };
  list[index] = updated;
  return updated;
} 