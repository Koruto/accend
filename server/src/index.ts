import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

async function bootstrap() {
  const app = Fastify({ logger: true });

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

  app.get('/', async () => ({ status: 'ok' }));

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap(); 