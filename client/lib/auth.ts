import { apiFetch } from '@/lib/api';
import type { PublicUser } from '@/types/auth';

export async function signup(input: {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'approver';
}): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: input,
  });
}

export async function login(input: { email: string; password: string }): Promise<{ user: PublicUser }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function me(): Promise<{ user: PublicUser | null }> {
  return apiFetch('/auth/me');
} 