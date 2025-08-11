import { signUserSession, SESSION_COOKIE } from '../auth/jwt';
import { createUser, verifyUser, getUserPublicById } from '../auth/store';
import { loginSchema, signupSchema } from '../auth/schemas';
import { resources, requestsByUserId, seedRequestsForUser } from '../store';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { RequestRecord } from '../models/request';
import { environments, getActiveBookingForEnv, nextFreeAt, createImmediateBooking, getUserActiveBooking, bookingsByEnvId, extendBookingForUser, releaseBookingForUser } from '../store/env-booking';

const createRequestSchema = z.object({
  resourceId: z.string().min(1),
  justification: z.string().min(6),
  durationHours: z.number().int().positive().optional(),
});
const decideRequestSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  decisionNote: z.string().optional(),
});

export const resolvers = (cookieSecure: boolean) => ({
  Query: {
    viewer: async (_: unknown, __: unknown, ctx: any) => ctx.user,
    resources: async (_: unknown, __: unknown, ctx: any) => {
      const role = ctx.user?.role as 'developer' | 'qa' | 'admin' | undefined;
      if (!role || role === 'admin') return resources;
      return resources.filter((r) => !r.allowedRequesterRoles || r.allowedRequesterRoles.includes(role));
    },
    myRequests: async (_: unknown, _args: any, ctx: any) => {
      const user = ctx.user;
      if (!user) return [];
      seedRequestsForUser(user.id);
      return requestsByUserId.get(user.id) ?? [];
    },
    adminPendingRequests: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') return [];
      // flatten all users' pending requests
      const out: { request: RequestRecord; requesterName: string }[] = [];
      for (const [, list] of requestsByUserId) {
        for (const r of list) {
          if (r.status === 'pending') {
            const requester = getUserPublicById(r.userId);
            out.push({ request: r, requesterName: requester?.name || 'User' });
          }
        }
      }
      // newest first
      out.sort((a, b) => (b.request.createdAt || '').localeCompare(a.request.createdAt || ''));
      return out;
    },
    bookingsAll: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') return [];
      const list: any[] = [];
      for (const [, bookings] of bookingsByEnvId) list.push(...bookings);
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },

    environments: async () => {
      const now = new Date();
      return environments.map((env) => {
        const freeAt = nextFreeAt(env.id, now);
        const active = getActiveBookingForEnv(env.id, now);
        return {
          id: env.id,
          name: env.name,
          bufferMinutes: env.bufferMinutes,
          isFreeNow: !active && freeAt && freeAt <= now,
          freeAt: freeAt?.toISOString() ?? null,
        } as any;
      });
    },
    activeBookingMe: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user) return null;
      const booking = getUserActiveBooking(user.id, new Date());
      return booking ?? null;
    },
    bookingsMe: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user) return [];
      const list: any[] = [];
      for (const [, bookings] of bookingsByEnvId) list.push(...bookings.filter((b) => b.userId === user.id));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },

    branchRefs: async (_: unknown, args: { projectKey?: string | null }, _ctx: any) => {
      const project = (args.projectKey || 'default').toLowerCase();
      if (project === 'web-app') return ['main', 'develop', 'release/2025-08-15', 'feature/checkout-refactor'];
      return ['main', 'develop', 'hotfix/login', 'feature/test-run-mvp'];
    },
  },
  Mutation: {
    signup: async (_: unknown, args: { input: { name: string; email: string; password: string; role: 'developer' | 'qa' | 'admin' } }, ctx: { reply: FastifyReply }) => {
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
      const role = user.role as 'developer' | 'qa' | 'admin';
      if (role !== 'admin' && resource.allowedRequesterRoles && !resource.allowedRequesterRoles.includes(role)) {
        throw new Error('FORBIDDEN');
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
    decideRequest: async (_: unknown, args: { input: { requestId: string; approve: boolean; decisionNote?: string } }, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') throw new Error('FORBIDDEN');
      const parsed = decideRequestSchema.safeParse(args.input);
      if (!parsed.success) throw new Error('INVALID_BODY');
      // Find the request across all users
      let target: RequestRecord | null = null;
      let ownerUserId: string | null = null;
      for (const [uid, list] of requestsByUserId) {
        const found = list.find((r) => r.id === parsed.data.requestId);
        if (found) {
          target = found;
          ownerUserId = uid;
          break;
        }
      }
      if (!target || !ownerUserId) throw new Error('REQUEST_NOT_FOUND');
      target.status = parsed.data.approve ? 'approved' : 'denied';
      target.approverId = user.id;
      target.approverName = user.name;
      target.approvedAt = new Date().toISOString();
      target.decisionNote = parsed.data.decisionNote ?? null;
      if (parsed.data.approve && target.durationHours && target.durationHours > 0) {
        const created = new Date(target.createdAt).getTime();
        target.expiresAt = new Date(created + target.durationHours * 3600 * 1000).toISOString();
      }
      return target;
    },

    createEnvironmentBooking: async (_: unknown, args: { envId: string; durationMinutes: number; justification: string }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      if (args.durationMinutes <= 0) throw new Error('INVALID_DURATION');
      return createImmediateBooking({ envId: args.envId, userId: user.id, justification: args.justification, durationMinutes: args.durationMinutes });
    },
    extendEnvironmentBooking: async (_: unknown, args: { bookingId: string; addMinutes: number }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      return extendBookingForUser({ bookingId: args.bookingId, userId: user.id, addMinutes: args.addMinutes, isAdmin: user.role === 'admin' });
    },
    releaseEnvironmentBooking: async (_: unknown, args: { bookingId: string }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      return releaseBookingForUser({ bookingId: args.bookingId, userId: user.id, isAdmin: user.role === 'admin' });
    },
  },
});

export default resolvers; 