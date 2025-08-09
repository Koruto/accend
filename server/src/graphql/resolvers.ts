import { signUserSession, SESSION_COOKIE } from '../auth/jwt';
import { createUser, verifyUser } from '../auth/store';
import { loginSchema, signupSchema } from '../auth/schemas';

export const resolvers = (cookieSecure: boolean) => ({
  Query: {
    viewer: async (_: unknown, __: unknown, ctx: any) => ctx.user,
    resources: async () => {
      return [];
    },
    myRequests: async (_: unknown, _args: any, _ctx: any) => {
      return [];
    },
    metricsMe: async () => ({ activeAccesses: 0, pending: 0, expiring7d: 0, activeDeploymentLocks: 0 }),
  },
  Mutation: {
    signup: async (_: unknown, args: { input: { name: string; email: string; password: string; role: 'manager' | 'approver' } }, ctx: any) => {
      const parsed = signupSchema.safeParse(args.input);
      if (!parsed.success) {
        throw new Error('INVALID_BODY');
      }
      const user = await createUser(parsed.data);
      const token = signUserSession(user);
      ctx.reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return { user };
    },
    login: async (_: unknown, args: { input: { email: string; password: string } }, ctx: any) => {
      const parsed = loginSchema.safeParse(args.input);
      if (!parsed.success) {
        throw new Error('INVALID_BODY');
      }
      const user = await verifyUser(parsed.data.email, parsed.data.password);
      if (!user) {
        throw new Error('INVALID_CREDENTIALS');
      }
      const token = signUserSession(user);
      ctx.reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return { user };
    },
    logout: async (_: unknown, __: unknown, ctx: any) => {
      ctx.reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return true;
    },
    createRequest: async () => {
      throw new Error('NOT_IMPLEMENTED');
    },
  },
});

export default resolvers; 