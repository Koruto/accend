import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import mercurius from 'mercurius';
import { verifySessionToken, signUserSession, SESSION_COOKIE } from './auth/jwt';
import { createUser, verifyUser } from './auth/store';
import { loginSchema, signupSchema } from './auth/schemas';

const isProd = process.env.NODE_ENV === 'production';

function createLoggerOptions() {
  const redact = {
    paths: ['req.headers.authorization', 'req.headers.cookie'] as string[],
    remove: true,
  };

  if (isProd) {
    return {
      level: process.env.LOG_LEVEL || 'info',
      redact,
    };
  }

  return {
    level: process.env.LOG_LEVEL || 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        singleLine: false,
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    },
    redact,
  };
}

async function bootstrap() {
  const app = Fastify({ logger: createLoggerOptions(), genReqId: () => randomUUID() });

  const port = Number(process.env.PORT ?? 4000);
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const cookieSecure = (process.env.COOKIE_SECURE ?? 'false') === 'true';

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  await app.register(cookie, {
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/',
    },
  });

  const requestStart = new WeakMap<object, number>();
  app.addHook('onRequest', (req, _reply, done) => {
    requestStart.set(req, Date.now());
    done();
  });
  app.addHook('onResponse', (req, reply, done) => {
    const start = requestStart.get(req);
    const responseTimeMs = typeof start === 'number' ? Date.now() - start : undefined;
    const status = reply.statusCode;
    const msg = `${req.method} ${req.url} -> ${status}${typeof responseTimeMs === 'number' ? ` (${responseTimeMs}ms)` : ''}`;
    const fields = { requestId: req.id, method: req.method, url: req.url, statusCode: status, responseTimeMs };

    if (status >= 500) {
      req.log.error(fields, msg);
    } else if (status >= 400) {
      req.log.warn(fields, msg);
    } else {
      req.log.info(fields, msg);
    }
    done();
  });

  app.setErrorHandler((err, req, reply) => {
    const status = (err as any).statusCode ?? 500;
    const msg = `${req.method} ${req.url} -> ${status} ${err.message}`;
    const fields = { requestId: req.id, code: (err as any).code, name: err.name };

    if (status >= 500) req.log.error(fields, msg);
    else req.log.warn(fields, msg);

    reply.status(status).send(err);
  });

  app.get('/health', async () => ({ status: 'ok' }));


  const typeDefs = `
    enum UserRole { manager approver }

    type User { id: ID! name: String! email: String! role: UserRole! }

    input SignupInput { name: String!, email: String!, password: String!, role: UserRole! }
    input LoginInput { email: String!, password: String! }

    type AuthPayload { user: User! }

    type Query {
      viewer: User
    }

    type Mutation {
      signup(input: SignupInput!): AuthPayload!
      login(input: LoginInput!): AuthPayload!
      logout: Boolean!
    }
  `;

  const resolvers = {
    Query: {
      viewer: async (_: unknown, __: unknown, ctx: any) => ctx.user,
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
    },
  };

  await app.register(mercurius as any, {
    schema: typeDefs,
    resolvers: resolvers as any,
    graphiql: process.env.NODE_ENV !== 'production',
    context: (request: import('fastify').FastifyRequest) => {
      const token = (request as any).cookies['accend_session'];
      const user = token ? verifySessionToken(token) : null;
      return { user };
    },
  });

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`API listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap(); 