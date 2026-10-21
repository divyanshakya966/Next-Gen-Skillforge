import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import analyzeRoute, {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_ERROR_MESSAGE,
} from '../../src/routes/analyze';
import type { Env } from '../../src/session';
import type { DashboardSessionData } from '../../src/types';

vi.mock('../../src/engine', () => ({
  runAnalysis: vi.fn(async () => ({
    profile: {
      links: { github: 'https://github.com/testuser' },
      technicalSkills: [],
      softSkills: [],
      jobRecommendations: [],
      aiSummary: {
        overview: 'Good profile',
        strengths: [],
        gaps: [],
        industryRelevanceScore: 85,
        atsScore: 80,
        atsFeedback: [],
        industryInsights: 'Stable',
        topSkills: [],
      },
      learningPath: [],
    },
    warnings: [],
    sourceCount: 1,
    engine: 'heuristic',
    focus: 'frontend',
  })),
}));

describe('getClientIdentifier', () => {
  it('prefers session userId over IP headers', () => {
    const mockContext = {
      get: (key: string) => (key === 'userId' ? 'user-123' : null),
      req: {
        header: (name: string) => (name === 'cf-connecting-ip' ? '203.0.113.1' : undefined),
      },
    } as any;
    expect(getClientIdentifier(mockContext)).toBe('session:user-123');
  });

  it('falls back to cf-connecting-ip when userId is null', () => {
    const mockContext = {
      get: () => null,
      req: {
        header: (name: string) => {
          if (name === 'cf-connecting-ip') return '203.0.113.195';
          return undefined;
        },
      },
    } as any;
    expect(getClientIdentifier(mockContext)).toBe('ip:203.0.113.195');
  });

  it('falls back to x-forwarded-for first IP when cf-connecting-ip is missing', () => {
    const mockContext = {
      get: () => null,
      req: {
        header: (name: string) => {
          if (name === 'x-forwarded-for') return '198.51.100.1, 10.0.0.1';
          return undefined;
        },
      },
    } as any;
    expect(getClientIdentifier(mockContext)).toBe('ip:198.51.100.1');
  });

  it('falls back to anonymous when neither userId nor IP headers exist', () => {
    const mockContext = {
      get: () => null,
      req: {
        header: () => undefined,
      },
    } as any;
    expect(getClientIdentifier(mockContext)).toBe('anonymous');
  });

  it('falls back to anonymous if x-forwarded-for has leading comma or empty entries', () => {
    const mockContext = {
      get: () => null,
      req: {
        header: (name: string) => {
          if (name === 'x-forwarded-for') return ',   , ';
          return undefined;
        },
      },
    } as any;
    expect(getClientIdentifier(mockContext)).toBe('anonymous');
  });
});

describe('checkRateLimit', () => {
  let mockStore: Map<string, string>;
  let mockKV: Env['SESSION_KV'];

  beforeEach(() => {
    mockStore = new Map<string, string>();
    mockKV = {
      get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        mockStore.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        mockStore.delete(key);
      }),
    };
  });

  it('allows requests 1 through 5 and rejects request 6', async () => {
    const id = 'test-client';
    const startTime = 1000000;

    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const res = await checkRateLimit(mockKV, id, startTime + i * 1000);
      expect(res.allowed).toBe(true);
      expect(res.count).toBe(i);
    }

    const blocked = await checkRateLimit(mockKV, id, startTime + 6000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(5);
  });

  it('does not increment count once limit is reached', async () => {
    const id = 'test-client';
    const startTime = 1000000;

    for (let i = 1; i <= 5; i++) {
      await checkRateLimit(mockKV, id, startTime);
    }

    const res6 = await checkRateLimit(mockKV, id, startTime + 1000);
    expect(res6.allowed).toBe(false);

    const res7 = await checkRateLimit(mockKV, id, startTime + 2000);
    expect(res7.allowed).toBe(false);
    expect(res7.count).toBe(5);
  });

  it('resets quota after 10-minute window expires', async () => {
    const id = 'expiring-client';
    const startTime = 1000000;

    for (let i = 1; i <= 5; i++) {
      await checkRateLimit(mockKV, id, startTime);
    }

    const blocked = await checkRateLimit(mockKV, id, startTime + 1000);
    expect(blocked.allowed).toBe(false);

    // After 10 minutes (600,000 ms)
    const afterExpiry = startTime + (RATE_LIMIT_WINDOW_SECONDS + 1) * 1000;
    const resetRes = await checkRateLimit(mockKV, id, afterExpiry);
    expect(resetRes.allowed).toBe(true);
    expect(resetRes.count).toBe(1);
  });

  it('isolates rate limits between separate identifiers', async () => {
    const userA = 'session:user-a';
    const userB = 'session:user-b';
    const ipA = 'ip:1.1.1.1';
    const startTime = 1000000;

    for (let i = 1; i <= 5; i++) {
      await checkRateLimit(mockKV, userA, startTime);
    }

    expect((await checkRateLimit(mockKV, userA, startTime)).allowed).toBe(false);
    expect((await checkRateLimit(mockKV, userB, startTime)).allowed).toBe(true);
    expect((await checkRateLimit(mockKV, ipA, startTime)).allowed).toBe(true);
  });

  it('fails open when KV get throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorKV = {
      ...mockKV,
      get: vi.fn(async () => {
        throw new Error('KV read timeout');
      }),
    };

    const res = await checkRateLimit(errorKV, 'err-client');
    expect(res.allowed).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('still allows request when KV put throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorKV = {
      ...mockKV,
      put: vi.fn(async () => {
        throw new Error('KV write error');
      }),
    };

    const res = await checkRateLimit(errorKV, 'err-client');
    expect(res.allowed).toBe(true);
    expect(res.count).toBe(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('maintains a stable resetAt timestamp across requests within the window', async () => {
    const id = 'stable-window-client';
    const startTime = 1000000;

    await checkRateLimit(mockKV, id, startTime);
    const key = `ratelimit:analyze:${id}`;
    const initialRecord = JSON.parse(mockStore.get(key)!);
    const expectedResetAt = startTime + RATE_LIMIT_WINDOW_SECONDS * 1000;
    expect(initialRecord.resetAt).toBe(expectedResetAt);

    // Make second request halfway through window
    const halfwayTime = startTime + 300 * 1000;
    await checkRateLimit(mockKV, id, halfwayTime);
    const updatedRecord = JSON.parse(mockStore.get(key)!);
    expect(updatedRecord.resetAt).toBe(expectedResetAt);
    expect(updatedRecord.count).toBe(2);
  });

  it('enforces a minimum 60-second KV TTL even when remaining window time is less than 60s', async () => {
    const id = 'ttl-test-client';
    const startTime = 1000000;

    await checkRateLimit(mockKV, id, startTime);

    // Make second request 590 seconds in (only 10 seconds remaining in 600s window)
    const lateTime = startTime + 590 * 1000;
    await checkRateLimit(mockKV, id, lateTime);

    expect(mockKV.put).toHaveBeenLastCalledWith(
      `ratelimit:analyze:${id}`,
      expect.any(String),
      { expirationTtl: 60 },
    );
  });

  it('fails open when KV binding is undefined or null', async () => {
    const res = await checkRateLimit(undefined as any, 'no-kv-client');
    expect(res.allowed).toBe(true);
    expect(res.count).toBe(0);
  });
});

describe('POST /api/analyze route integration', () => {
  let mockStore: Map<string, string>;
  let mockEnv: Env;
  let testApp: Hono<{
    Bindings: Env;
    Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
  }>;
  let activeSession: DashboardSessionData;
  let activeUserId: string | null;

  beforeEach(async () => {
    mockStore = new Map<string, string>();
    mockEnv = {
      SESSION_KV: {
        get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          mockStore.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          mockStore.delete(key);
        }),
      },
      SESSION_SECRET: 'test-secret-minimum-thirty-two-characters-long',
    };

    activeSession = {
      preferences: {
        links: { github: 'https://github.com/testuser' },
      },
    };
    activeUserId = 'test-session-user';

    testApp = new Hono<{
      Bindings: Env;
      Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
    }>();

    testApp.use('*', async (c, next) => {
      c.set('session', activeSession);
      c.set('userId', activeUserId);
      c.set('secure', false);
      await next();
    });

    testApp.route('/api/analyze', analyzeRoute);
  });

  it('does not consume quota when request fails input validation (400 Bad Request)', async () => {
    activeSession = { preferences: { links: {} }, resumeText: undefined };

    const res = await testApp.request('/api/analyze', { method: 'POST' }, mockEnv);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('Add at least one profile link');

    const key = `ratelimit:analyze:session:${activeUserId}`;
    expect(mockStore.has(key)).toBe(false);
  });

  it('allows 5 successful requests and returns 429 on the 6th request', async () => {
    const { runAnalysis } = await import('../../src/engine');
    vi.mocked(runAnalysis).mockClear();

    for (let i = 1; i <= 5; i++) {
      const res = await testApp.request('/api/analyze', { method: 'POST' }, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean };
      expect(json.ok).toBe(true);
    }

    expect(runAnalysis).toHaveBeenCalledTimes(5);

    // 6th request must be rejected with 429
    const blockedRes = await testApp.request('/api/analyze', { method: 'POST' }, mockEnv);
    expect(blockedRes.status).toBe(429);

    const blockedJson = (await blockedRes.json()) as { error: string };
    expect(blockedJson).toEqual({
      error: RATE_LIMIT_ERROR_MESSAGE,
    });

    // runAnalysis MUST NOT have been called for the 6th request
    expect(runAnalysis).toHaveBeenCalledTimes(5);
  });

  it('uses IP fallback and limits unauthenticated requests independently', async () => {
    activeUserId = null; // No session cookie

    // Request with IP 203.0.113.5
    for (let i = 1; i <= 5; i++) {
      const res = await testApp.request(
        '/api/analyze',
        {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.5' },
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
    }

    // 6th request from same IP is rate limited
    const resBlocked = await testApp.request(
      '/api/analyze',
      {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.5' },
      },
      mockEnv,
    );
    expect(resBlocked.status).toBe(429);

    // Request from a different IP is allowed
    const resOtherIp = await testApp.request(
      '/api/analyze',
      {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.6' },
      },
      mockEnv,
    );
    expect(resOtherIp.status).toBe(200);
  });
});
