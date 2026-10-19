import { Hono } from 'hono';
import { makeSessionCookie, type Env } from '../session';
import { persistSession } from '../store';
import { linkSignature } from '../validate';
import { runAnalysis } from '../engine';
import type { DashboardSessionData } from '../types';

const app = new Hono<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>();

app.post('/', async (c) => {
  const session = c.get('session');
  const links = session.preferences?.links ?? {};
  const resumeText = session.resumeText;

  const hasLinks = Object.values(links).some((value) => Boolean(value && String(value).trim()));
  if (!hasLinks && !resumeText) {
    return c.json(
      { error: 'Add at least one profile link or upload a resume before running analysis.' },
      400,
    );
  }

  try {
    const result = await runAnalysis(c.env, {
      links,
      resumeText,
      resumeFileName: session.resumeFileName,
    });

    const analysis = {
      signature: linkSignature(links),
      profile: result.profile,
      createdAt: new Date().toISOString(),
    };

    const history = session.analysisHistory ?? [];
    session.analysis = analysis;
    session.analysisHistory = [analysis, ...history].slice(0, 10);
    const { cookieValue } = await persistSession(c.env, session, c.get('userId'));

    return c.json(
      {
        ok: true,
        analysis,
        engine: result.engine,
        sourceCount: result.sourceCount,
        focus: result.focus,
        warnings: result.warnings,
      },
      { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const warnings = (error as { warnings?: unknown[] }).warnings ?? [];
    console.error('Analysis failed:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Analysis failed.',
        warnings,
      },
      status as 400 | 422 | 500,
    );
  }
});

export default app;
