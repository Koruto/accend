import { FastifyInstance } from 'fastify';
import { loginSchema, signupSchema } from '../auth/schemas';
import { createUser, verifyUser, getUserByEmail } from '../auth/store';
import { signUserSession, verifySessionToken, SESSION_COOKIE } from '../auth/jwt';

export async function authRoutes(app: FastifyInstance) {
  const cookieSecure = (process.env.COOKIE_SECURE ?? 'false') === 'true';

  app.post('/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }
    try {
      const user = await createUser(parsed.data);
      const token = signUserSession(user);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return { user };
    } catch (err: any) {
      if (err && err.message === 'EMAIL_EXISTS') {
        return reply.code(409).send({ error: 'EMAIL_EXISTS' });
      }
      request.log.error({ err }, 'signup failed');
      return reply.code(500).send({ error: 'SERVER_ERROR' });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }
    const user = await verifyUser(parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    const token = signUserSession(user);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return { user };
  });

  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return { user: null };
    const user = verifySessionToken(token);
    if (!user) return { user: null };
    // Ensure user still exists (in case of future persistence)
    const existing = getUserByEmail(user.email);
    return { user: existing ?? user };
  });
} 