import { randomUUID } from 'node:crypto';
import { signUserSession, SESSION_COOKIE } from '../auth/jwt';
import { createUser, verifyUser, getUserPublicById, updateUserName } from '../auth/store';
import { loginSchema, signupSchema } from '../auth/schemas';
import { resources } from '../store/index.js';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { RequestRecord } from '../models/request';
import { environments, getActiveBookingForEnv, nextFreeAt, createImmediateBooking, getUserActiveBooking, extendBookingForUser, releaseBookingForUser } from '../store/env-booking.js';
import { getCollection } from '../store/mongo.js';

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
      const col = getCollection<RequestRecord>('requests');
      const list = await col.find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
      return list;
    },
    adminAllRequests: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') return [];
      const col = getCollection<RequestRecord>('requests');
      const list = await col.find({}).sort({ createdAt: -1 }).toArray();
      const out: { request: RequestRecord; requesterName: string; requesterEmail: string }[] = [];
      for (const r of list) {
        const requester = await getUserPublicById(r.userId);
        out.push({ request: r, requesterName: requester?.name || 'User', requesterEmail: requester?.email || '' });
      }
      return out;
    },
    adminPendingRequests: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') return [];
      const col = getCollection<RequestRecord>('requests');
      const list = await col.find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
      const out: { request: RequestRecord; requesterName: string; requesterEmail: string }[] = [];
      for (const r of list) {
        const requester = await getUserPublicById(r.userId);
        out.push({ request: r, requesterName: requester?.name || 'User', requesterEmail: requester?.email || '' });
      }
      return out;
    },
    bookingsAll: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') return [];
      const col = getCollection<any>('bookings');
      const list = await col.find({}).sort({ createdAt: -1 }).toArray();
      return list;
    },

    environments: async () => {
      const now = new Date();
      const out: any[] = [];
      for (const env of environments) {
        const freeAt = await nextFreeAt(env.id, now);
        const active = await getActiveBookingForEnv(env.id, now);
        out.push({
          id: env.id,
          name: env.name,
          isFreeNow: !active && freeAt && freeAt <= now,
          freeAt: freeAt?.toISOString() ?? null,
          accessLevelRequired: env.accessLevelRequired ?? null,
        });
      }
      return out;
    },
    activeBookingMe: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user) return null;
      const booking = await getUserActiveBooking(user.id, new Date());
      return booking ?? null;
    },
    bookingsMe: async (_: unknown, __: unknown, ctx: any) => {
      const user = ctx.user;
      if (!user) return [];
      const col = getCollection<any>('bookings');
      const list = await col.find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
      return list;
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
      const col = getCollection<RequestRecord>('requests');
      const now = new Date();
      const request: RequestRecord = {
        id: randomUUID(),
        userId: user.id,
        resourceId: resource.id,
        resourceType: resource.type,
        status: 'pending',
        justification: parsed.data.justification,
        createdAt: now.toISOString(),
        durationHours: parsed.data.durationHours ?? null,
      };
      await col.insertOne(request);
      return request;
    },
    decideRequest: async (_: unknown, args: { input: { requestId: string; approve: boolean; decisionNote?: string } }, ctx: any) => {
      const user = ctx.user;
      if (!user || user.role !== 'admin') throw new Error('FORBIDDEN');
      const parsed = decideRequestSchema.safeParse(args.input);
      if (!parsed.success) throw new Error('INVALID_BODY');
      const col = getCollection<RequestRecord>('requests');
      const existing = await col.findOne({ id: parsed.data.requestId });
      if (!existing) throw new Error('REQUEST_NOT_FOUND');
      const updates: Partial<RequestRecord> = {
        status: parsed.data.approve ? 'approved' : 'denied',
        approverId: user.id,
        approverName: user.name,
        approvedAt: new Date().toISOString(),
        decisionNote: parsed.data.decisionNote ?? null,
      };
      if (parsed.data.approve && existing.durationHours && existing.durationHours > 0) {
        const created = new Date(existing.createdAt).getTime();
        (updates as any).expiresAt = new Date(created + existing.durationHours * 3600 * 1000).toISOString();
      }
      await col.updateOne({ id: parsed.data.requestId }, { $set: updates });
      const updated = await col.findOne({ id: parsed.data.requestId });
      if (!updated) throw new Error('REQUEST_NOT_FOUND');
      return updated;
    },

    createEnvironmentBooking: async (_: unknown, args: { envId: string; durationMinutes: number; justification: string }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      if (args.durationMinutes <= 0) throw new Error('INVALID_DURATION');
      const env = environments.find((e) => e.id === args.envId);
      if (!env) throw new Error('ENV_NOT_FOUND');
      if ((env.accessLevelRequired ?? 0) > 0 && user.role !== 'admin' && (user.accessLevel ?? 0) < (env.accessLevelRequired ?? 0)) {
        throw new Error('INSUFFICIENT_ACCESS');
      }
      const booking = await createImmediateBooking({ envId: args.envId, userId: user.id, justification: args.justification, durationMinutes: args.durationMinutes });
      // Link to a request row in MyRequests for visibility
      const col = getCollection<RequestRecord>('requests');
      const request: RequestRecord = {
        id: booking.id,
        userId: user.id,
        resourceId: args.envId,
        resourceType: 'deployment_env_lock',
        status: 'approved',
        justification: args.justification,
        createdAt: booking.createdAt,
        durationHours: Math.ceil(args.durationMinutes / 60),
        approvedAt: booking.createdAt,
        expiresAt: booking.endsAt,
        approverId: user.role === 'admin' ? user.id : null,
        approverName: user.role === 'admin' ? user.name : null,
        bookingId: booking.id,
      };
      await col.insertOne(request);
      return booking;
    },
    extendEnvironmentBooking: async (_: unknown, args: { bookingId: string; addMinutes: number }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      const updated = await extendBookingForUser({ bookingId: args.bookingId, userId: user.id, addMinutes: args.addMinutes, isAdmin: user.role === 'admin' });
      // Update linked request expiry and duration if present
      const col = getCollection<RequestRecord>('requests');
      const target = await col.findOne({ bookingId: args.bookingId });
      if (target) {
        const base = (target.durationHours ?? 0) * 60;
        await col.updateOne(
          { bookingId: args.bookingId },
          { $set: { expiresAt: updated.endsAt ?? target.expiresAt ?? null, durationHours: Math.ceil((base + args.addMinutes) / 60) } }
        );
      }
      return updated;
    },
    releaseEnvironmentBooking: async (_: unknown, args: { bookingId: string }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      const released = await releaseBookingForUser({ bookingId: args.bookingId, userId: user.id, isAdmin: user.role === 'admin' });
      // Update linked request status
      const col = getCollection<RequestRecord>('requests');
      await col.updateOne(
        { bookingId: args.bookingId },
        { $set: { status: 'expired', expiresAt: released.endsAt ?? null } }
      );
      return released;
    },

    updateMeName: async (_: unknown, args: { name: string }, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('UNAUTHENTICATED');
      if (!args.name || args.name.trim().length < 2) throw new Error('INVALID_NAME');
      const updated = await updateUserName(user.id, args.name.trim());
      return updated;
    },
  },
});

export default resolvers; 