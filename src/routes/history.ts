import { Hono } from 'hono';
import { makeSessionCookie, type Env } from '../session';
import { persistSession } from '../store';
import type { DashboardSessionData, StoredAnalysis, HistorySummaryItem, SocialLinks } from '../types';

const app = new Hono<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>();

export function toHistorySummaryItem(item: StoredAnalysis, index: number): HistorySummaryItem {
  const profile = (item.profile && typeof item.profile === 'object')
    ? (item.profile as Record<string, unknown>)
    : null;

  const aiSummary = (profile?.aiSummary && typeof profile.aiSummary === 'object')
    ? (profile.aiSummary as Record<string, unknown>)
    : null;

  const overview = typeof aiSummary?.overview === 'string' ? aiSummary.overview : undefined;
  const topSkills = Array.isArray(aiSummary?.topSkills)
    ? (aiSummary.topSkills.filter((s): s is string => typeof s === 'string').slice(0, 5))
    : undefined;

  let roleTitle: string | undefined;
  if (Array.isArray(profile?.jobRecommendations) && profile.jobRecommendations.length > 0) {
    const firstJob = profile.jobRecommendations[0];
    if (firstJob && typeof firstJob === 'object' && typeof (firstJob as Record<string, unknown>).title === 'string') {
      roleTitle = (firstJob as Record<string, unknown>).title as string;
    }
  }

  return {
    index,
    signature: item.signature || '',
    createdAt: item.createdAt || new Date().toISOString(),
    headline: overview ? overview.slice(0, 120) : undefined,
    focus: roleTitle || overview?.slice(0, 60),
    topSkills,
    roleTitle,
  };
}

// GET /api/session/history - returns lightweight history summaries
app.get('/', async (c) => {
  const session = c.get('session') ?? {};
  const history = session.analysisHistory ?? [];

  const summaries = history.map((entry, idx) => toHistorySummaryItem(entry, idx));

  return c.json({ history: summaries });
});

// POST /api/session/history/restore - restores an analysis by index or signature
app.post('/restore', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Request body must be an object with index or signature.' }, 400);
  }

  const payload = body as Record<string, unknown>;
  const session = c.get('session') ?? {};
  const history = session.analysisHistory ?? [];

  let targetIndex = -1;

  if (typeof payload.index === 'number') {
    targetIndex = payload.index;
  } else if (typeof payload.signature === 'string' && payload.signature) {
    targetIndex = history.findIndex((entry) => entry.signature === payload.signature);
  }

  if (targetIndex < 0 || targetIndex >= history.length) {
    return c.json({ error: 'History entry not found.' }, 400);
  }

  const selected = history[targetIndex];
  if (!selected) {
    return c.json({ error: 'History entry not found.' }, 400);
  }

  // Restore entry into session.analysis
  session.analysis = selected;

  // Sync preference links to the restored profile's links if present
  const profile = (selected.profile && typeof selected.profile === 'object')
    ? (selected.profile as Record<string, unknown>)
    : null;
  if (profile && typeof profile.links === 'object' && profile.links !== null) {
    session.preferences = {
      ...(session.preferences ?? {}),
      links: profile.links as Partial<SocialLinks>,
    };
  }

  const { cookieValue } = await persistSession(c.env, session, c.get('userId'));

  return c.json(
    { ok: true, restored: selected },
    { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
  );
});

export default app;
