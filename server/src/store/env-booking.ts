import { randomUUID } from 'node:crypto';
import type { EnvironmentRecord } from '../models/environment';
import type { BookingRecord } from '../models/booking';
import { getCollection } from './mongo';

export const environments: EnvironmentRecord[] = [
  { id: 'env_dev', name: 'Development', accessLevelRequired: 1 },
  { id: 'env_test', name: 'Test', accessLevelRequired: 2 },
  { id: 'env_staging', name: 'Staging', accessLevelRequired: 3 },
  { id: 'env_uat', name: 'UAT', accessLevelRequired: 4 },
];

function isActive(b: BookingRecord, now: Date): boolean {
  if (b.status !== 'approved' && b.status !== 'active') return false;
  if (!b.startedAt || !b.endsAt) return false;
  return new Date(b.startedAt) <= now && now < new Date(b.endsAt);
}

export async function getActiveBookingForEnv(envId: string, now = new Date()): Promise<BookingRecord | null> {
  const col = getCollection<BookingRecord>('bookings');
  const nowIso = now.toISOString();
  const found = await col.findOne({ envId, startedAt: { $lte: nowIso }, endsAt: { $gt: nowIso }, status: { $in: ['approved', 'active'] } });
  return found ?? null;
}

export async function getLatestBookingForEnv(envId: string): Promise<BookingRecord | null> {
  const col = getCollection<BookingRecord>('bookings');
  const found = await col.find({ envId }).sort({ createdAt: -1 }).limit(1).next();
  return found ?? null;
}

export async function getUserActiveBooking(userId: string, now = new Date()): Promise<BookingRecord | null> {
  const col = getCollection<BookingRecord>('bookings');
  const nowIso = now.toISOString();
  const found = await col.findOne({ userId, startedAt: { $lte: nowIso }, endsAt: { $gt: nowIso }, status: { $in: ['approved', 'active'] } });
  return found ?? null;
}

export async function nextFreeAt(envId: string, now = new Date()): Promise<Date | null> {
  const active = await getActiveBookingForEnv(envId, now);
  if (active && active.endsAt) {
    return new Date(active.endsAt);
  }
  return now;
}

export async function createImmediateBooking(params: {
  envId: string;
  userId: string;
  justification: string;
  durationMinutes: number;
}): Promise<BookingRecord> {
  const { envId, userId, justification, durationMinutes } = params;
  const env = environments.find((e) => e.id === envId);
  if (!env) throw new Error('ENV_NOT_FOUND');

  const now = new Date();

  const existingMine = await getUserActiveBooking(userId, now);
  if (existingMine) {
    throw new Error('USER_ALREADY_HAS_ACTIVE_BOOKING');
  }

  const freeAt = await nextFreeAt(envId, now);
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

  const col = getCollection<BookingRecord>('bookings');
  await col.insertOne(record);
  return record;
}

async function findBookingById(bookingId: string): Promise<BookingRecord | null> {
  const col = getCollection<BookingRecord>('bookings');
  const found = await col.findOne({ id: bookingId });
  return found ?? null;
}

export async function extendBookingForUser(params: { bookingId: string; userId: string; addMinutes: number; isAdmin: boolean }): Promise<BookingRecord> {
  const { bookingId, userId, addMinutes, isAdmin } = params;
  if (addMinutes <= 0) throw new Error('INVALID_EXTENSION');
  const booking = await findBookingById(bookingId);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (!isAdmin && booking.userId !== userId) throw new Error('FORBIDDEN');
  if (!booking.startedAt || !booking.endsAt) throw new Error('NOT_ACTIVE');
  const now = new Date();
  if (!(new Date(booking.startedAt) <= now && now < new Date(booking.endsAt))) throw new Error('NOT_ACTIVE');
  const total = (booking.extensionMinutesTotal ?? 0) + addMinutes;
  if (total > 60) throw new Error('EXTENSION_LIMIT_EXCEEDED');
  const newEnds = new Date(new Date(booking.endsAt).getTime() + addMinutes * 60 * 1000).toISOString();
  const updated: BookingRecord = { ...booking, endsAt: newEnds, extensionMinutesTotal: total };
  const col = getCollection<BookingRecord>('bookings');
  await col.updateOne({ id: bookingId }, { $set: { endsAt: newEnds, extensionMinutesTotal: total } });
  return updated;
}

export async function releaseBookingForUser(params: { bookingId: string; userId: string; isAdmin: boolean }): Promise<BookingRecord> {
  const { bookingId, userId, isAdmin } = params;
  const booking = await findBookingById(bookingId);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (!isAdmin && booking.userId !== userId) throw new Error('FORBIDDEN');
  const nowIso = new Date().toISOString();
  const updated: BookingRecord = {
    ...booking,
    status: 'released',
    releasedAt: nowIso,
    closedReason: 'released',
    endsAt: nowIso,
  };
  const col = getCollection<BookingRecord>('bookings');
  await col.updateOne({ id: bookingId }, { $set: { status: 'released', releasedAt: nowIso, closedReason: 'released', endsAt: nowIso } });
  return updated;
} 