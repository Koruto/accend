import jwt, { JwtPayload } from 'jsonwebtoken';
import type { PublicUser } from './types';
import type { UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
export const SESSION_COOKIE = 'accend_session';

interface SessionClaims extends JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

export function signUserSession(user: PublicUser): string {
  const claims: SessionClaims = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): PublicUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionClaims;
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
} 