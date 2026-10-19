import { Hono } from 'hono';
import { makeSessionCookie, type Env } from '../session';
import { persistSession } from '../store';
import { linkSignature, sanitizeAnalysis } from '../validate';
import type { SocialLinks, DashboardSessionData, StoredAnalysis } from '../types';

const app = new Hono<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>();

app.get('/', async (c) => {
  const session = c.get('session');
  const currentSignature = linkSignature(session.preferences?.links ?? null);
  const analysis = session.analysis;

  if (analysis && analysis.signature === currentSignature) {
    return c.json({ analysis });
  }

  if (analysis) {
    // Links changed since the analysis was generated — invalidate it and
    // persist the deletion (including Set-Cookie so the client is updated).
    delete session.analysis;
    const { cookieValue } = await persistSession(c.env, session, c.get('userId'));
    return c.json(
      { analysis: null, stale: true },
      { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
    );
  }

  return c.json({ analysis: null });
});

app.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const analysis = sanitizeAnalysis(
    body && typeof body === 'object' ? (body as Record<string, unknown>).analysis : null,
  );
  if (!analysis) {
    return c.json({ error: 'Invalid analysis payload.' }, 400);
  }

  const session = c.get('session');
  const stored: StoredAnalysis = { ...analysis, createdAt: new Date().toISOString() };
  session.analysis = stored;
  const history = session.analysisHistory ?? [];
  session.analysisHistory = [stored, ...history].slice(0, 10);
  session.preferences = {
    ...(session.preferences ?? {}),
    links: (analysis.profile as { links?: SocialLinks }).links,
  };
  const { cookieValue } = await persistSession(c.env, session, c.get('userId'));

  return c.json(
    { ok: true, analysis: session.analysis },
    { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
  );
});

app.delete('/', async (c) => {
  const session = c.get('session');
  delete session.analysis;
  const { cookieValue } = await persistSession(c.env, session, c.get('userId'));
  return c.json(
    { ok: true },
    { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
  );
});

export default app;
