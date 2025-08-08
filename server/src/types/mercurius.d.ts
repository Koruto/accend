import type { PublicUser } from '../auth/types';

declare module 'mercurius' {
  interface MercuriusContext {
    user: PublicUser | null;
  }
} 