import { signUserSession, SESSION_COOKIE } from '../auth/jwt';
import { createUser, verifyUser } from '../auth/store';
import { loginSchema, signupSchema } from '../auth/schemas';
import { resources, requestsByUserId, seedRequestsForUser } from '../store';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { RequestRecord } from '../models/request';
import { isActive, isExpiringIn7Days } from '../models/request';

const createRequestSchema = z.object({
  resourceId: z.string().min(1),
  justification: z.string().min(6),
  durationHours: z.number().int().positive().optional(),
});

export const resolvers = (cookieSecure: boolean) => ({
  Query: {
    viewer: async (_: unknown, __: unknown, ctx: any) => ctx.user,
    resources: async () => resources,
    myRequests: async (_: unknown, _args: any, ctx: any) => {
      const user = ctx.user;
      if (!user) return [];
      seedRequestsForUser(user.id);
      return requestsByUserId.get(user.id) ?? [];
    },
    metricsMe: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user) return { activeAccesses: 0, pending: 0, expiring7d: 0, activeDeploymentLocks: 0 };
      seedRequestsForUser(user.id);
      const list = requestsByUserId.get(user.id) ?? [];
      const now = new Date();
      const activeAccesses = list.filter((r) => isActive(now, r)).length;
      const pending = list.filter((r) => r.status === 'pending').length;
      const expiring7d = list.filter((r) => isExpiringIn7Days(now, r)).length;
      const activeDeploymentLocks = list.filter((r) => r.resourceType === 'deployment_env_lock' && isActive(now, r)).length;
      return { activeAccesses, pending, expiring7d, activeDeploymentLocks };
    },
  },
  Mutation: {
    signup: async (_: unknown, args: { input: { name: string; email: string; password: string; role: 'manager' | 'approver' } }, ctx: { reply: FastifyReply }) => {
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
    login: async (_: unknown, args: { input: { email: string; password: string } }, ctx: { reply: FastifyReply }) => {
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
    logout: async (_: unknown, __: unknown, ctx: { reply: FastifyReply }) => {
      ctx.reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return true;
    },
    createRequest: async (_: unknown, args: { input: { resourceId: string; justification: string; durationHours?: number } }, ctx: any) => {
      const user = ctx.user;
      if (!user) {
        throw new Error('UNAUTHENTICATED');
      }
      const parsed = createRequestSchema.safeParse(args.input);
      if (!parsed.success) {
        throw new Error('INVALID_BODY');
      }
      const resource = resources.find((r) => r.id === parsed.data.resourceId);
      if (!resource) {
        throw new Error('RESOURCE_NOT_FOUND');
      }
      seedRequestsForUser(user.id);
      const list = requestsByUserId.get(user.id)!;
      const now = new Date();
      const request: RequestRecord = {
        id: crypto.randomUUID(),
        userId: user.id,
        resourceId: resource.id,
        resourceType: resource.type,
        status: 'pending',
        justification: parsed.data.justification,
        createdAt: now.toISOString(),
        durationHours: parsed.data.durationHours ?? null,
      };
      list.unshift(request);
      return request;
    },
  },
});

export default resolvers; 