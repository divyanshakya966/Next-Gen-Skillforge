import { Hono, type Context } from 'hono';
import { makeSessionCookie, type Env } from '../session';
import { persistSession } from '../store';
import { linkSignature } from '../validate';
import { runAnalysis } from '../engine';
import type { DashboardSessionData } from '../types';

export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
export const RATE_LIMIT_ERROR_MESSAGE =
  'Too many analysis requests. Please wait a few minutes and try again.';

export interface RateLimitRecord {
  count: number;
  resetAt: number; // Unix timestamp in milliseconds
}

export function getClientIdentifier(c: Context<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>): string {
  const userId = c.get('userId');
  if (userId && userId.trim()) return `session:${userId.trim()}`;
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return `ip:${cfIp.trim()}`;
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const clientIp = forwarded.split(',')[0]?.trim();
    if (clientIp) return `ip:${clientIp}`;
  }
  return 'anonymous';
}

/**
 * Approximate rate limiting using Cloudflare Workers KV.
 *
 * NOTE ON CONCURRENCY & EVENTUAL CONSISTENCY:
 * Cloudflare Workers KV is an eventually consistent distributed key-value store and does not
 * provide atomic read-modify-write (e.g. INCR or compare-and-swap) primitives. Under concurrent
 * requests arriving simultaneously across edge locations, race conditions may allow a temporary
 * burst beyond RATE_LIMIT_MAX_REQUESTS. This implementation provides best-effort / approximate
 * rate limiting to mitigate abusive traffic without introducing stateful infrastructure
 * (such as Cloudflare Durable Objects with SQLite migrations or external Redis instances), which
 * would require paid plan subscriptions and database migration architecture beyond the scope of
 * this repository's deployment configuration.
 *
 * NOTE ON FAIL-OPEN POLICY:
 * If KV reads or writes throw an error (or if the KV binding is unavailable), the rate limiter
 * fails open (allowed: true) so that infrastructure-level KV disruptions do not block legitimate
 * user analysis requests.
 */
export async function checkRateLimit(
  kv: Env['SESSION_KV'],
  identifier: string,
  now: number = Date.now(),
): Promise<{ allowed: boolean; count: number }> {
  if (!kv) {
    return { allowed: true, count: 0 };
  }

  const key = `ratelimit:analyze:${identifier}`;
  let record: RateLimitRecord | null = null;

  try {
    const raw = await kv.get(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.count === 'number' &&
          typeof parsed.resetAt === 'number' &&
          !isNaN(parsed.resetAt)
        ) {
          record = parsed as RateLimitRecord;
        } else if (typeof parsed === 'number') {
          record = { count: parsed, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 };
        }
      } catch {
        const num = parseInt(raw, 10);
        if (!isNaN(num)) {
          record = { count: num, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 };
        }
      }
    }
  } catch (err) {
    console.error('Rate limit KV get error:', err);
    return { allowed: true, count: 0 };
  }

  if (!record || now >= record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
    };
    try {
      await kv.put(key, JSON.stringify(newRecord), {
        expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
      });
    } catch (err) {
      console.error('Rate limit KV put error:', err);
    }
    return { allowed: true, count: 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, count: record.count };
  }

  record.count += 1;
  const remainingSeconds = Math.max(60, Math.ceil((record.resetAt - now) / 1000));
  try {
    await kv.put(key, JSON.stringify(record), {
      expirationTtl: remainingSeconds,
    });
  } catch (err) {
    console.error('Rate limit KV put error:', err);
  }

  return { allowed: true, count: record.count };
}

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

  const identifier = getClientIdentifier(c);
  const rateLimit = await checkRateLimit(c.env.SESSION_KV, identifier);
  if (!rateLimit.allowed) {
    return c.json(
      { error: RATE_LIMIT_ERROR_MESSAGE },
      429,
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

    session.analysis = analysis;
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
