import jwt from 'jsonwebtoken';
import type { PublicUser } from './types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
export const SESSION_COOKIE = 'accend_session';

export function signUserSession(user: PublicUser): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifySessionToken(token: string): PublicUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as any,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
} 