import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './session';
import { loadSession } from './store';
import type { DashboardSessionData } from './types';
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';
import preferencesRoute from './routes/preferences';
import analysisRoute from './routes/analysis';
import analyzeRoute from './routes/analyze';
import resumeRoute from './routes/resume';
import reportRoute from './routes/report';
import historyRoute from './routes/history';

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerEnv extends Env {
  ASSETS: AssetBinding;
}

type AppVariables = { session: DashboardSessionData; userId: string | null; secure: boolean };

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:8787', 'https://*.workers.dev', 'https://*.pages.dev'],
  allowHeaders: ['Content-Type', 'Cookie'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Resolve the encrypted session cookie into per-user data (D1 + KV).
app.use('*', async (c, next) => {
  const { session, userId } = await loadSession(c.env, c.req.header('cookie'));
  c.set('session', session);
  c.set('userId', userId);
  c.set('secure', new URL(c.req.url).protocol === 'https:');
  await next();
});

app.route('/api/session/preferences', preferencesRoute);
app.route('/api/session/analysis', analysisRoute);
app.route('/api/session/history', historyRoute);
app.route('/api/analyze', analyzeRoute);
app.route('/api/resume/import', resumeRoute);
app.route('/api/report/download', reportRoute);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
} as unknown as ExportedHandler<WorkerEnv>;
