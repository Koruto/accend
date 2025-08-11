import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import mercurius from 'mercurius';
import { verifySessionToken } from './auth/jwt';
import { typeDefs } from './graphql/schema';
import createResolvers from './graphql/resolvers';
import { connectMongo, ensureIndexes } from './store/mongo';

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

  const mongoUri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017';
  const mongoDb = process.env.MONGO_DB ?? 'accend';
  try {
    await connectMongo(mongoUri, mongoDb);
    await ensureIndexes();
    app.log.info(`Connected to MongoDB db=${mongoDb}`);
  } catch (err) {
    app.log.error({ err }, 'Failed to connect to MongoDB');
    throw err;
  }

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


  // GraphQL schema moved to dedicated module

  const resolvers = createResolvers(cookieSecure);

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