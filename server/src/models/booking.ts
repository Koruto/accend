export type BookingStatus = 'pending' | 'approved' | 'active' | 'finished' | 'expired' | 'released' | 'denied';

export interface BookingRecord {
  id: string;
  envId: string;
  userId: string;
  status: BookingStatus;
  createdAt: string; // ISO
  justification: string;
  startedAt?: string | null;
  endsAt?: string | null;
  releasedAt?: string | null;
  closedReason?: 'finished' | 'expired' | 'released' | 'denied';
  durationMinutes: number;
  extensionMinutesTotal?: number; // <= 60
} 