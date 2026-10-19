import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import historyRoute, { toHistorySummaryItem } from '../../src/routes/history';
import type { DashboardSessionData, StoredAnalysis } from '../../src/types';
import type { Env } from '../../src/session';

const mockSecret = 'test-secret-minimum-thirty-two-characters-long';
const mockKV = new Map<string, string>();
const mockEnv: Env = {
  SESSION_KV: {
    get: vi.fn(async (key: string) => mockKV.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      mockKV.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      mockKV.delete(key);
    }),
  },
  SESSION_SECRET: mockSecret,
};

const sampleProfile1 = {
  links: { github: 'https://github.com/alice' },
  technicalSkills: [{ skill: 'TypeScript', value: 90, fullMark: 100 }],
  softSkills: [{ skill: 'Leadership', value: 80, fullMark: 100 }],
  jobRecommendations: [
    {
      id: 1,
      title: 'Senior Frontend Engineer',
      company: 'Acme',
      matchPercentage: 92,
      salary: '$150k',
      location: 'Remote',
      type: 'Full-time',
      skills: ['TypeScript'],
      description: 'Lead web dev',
      applyUrl: 'https://example.com/apply1',
    },
  ],
  aiSummary: {
    overview: 'Experienced Frontend specialist with deep React expertise.',
    strengths: ['React', 'TypeScript'],
    gaps: ['Rust'],
    industryRelevanceScore: 90,
    atsScore: 85,
    atsFeedback: ['Strong skills'],
    industryInsights: 'High demand for web devs',
    topSkills: ['React', 'TypeScript', 'Node.js'],
  },
  learningPath: [],
};

const sampleProfile2 = {
  links: { github: 'https://github.com/bob' },
  technicalSkills: [{ skill: 'Python', value: 85, fullMark: 100 }],
  softSkills: [{ skill: 'Teamwork', value: 80, fullMark: 100 }],
  jobRecommendations: [
    {
      id: 2,
      title: 'Data Scientist',
      company: 'DataCorp',
      matchPercentage: 88,
      salary: '$140k',
      location: 'Remote',
      type: 'Full-time',
      skills: ['Python'],
      description: 'Analyze data',
      applyUrl: 'https://example.com/apply2',
    },
  ],
  aiSummary: {
    overview: 'Machine learning practitioner specializing in NLP.',
    strengths: ['Python', 'NLP'],
    gaps: ['C++'],
    industryRelevanceScore: 88,
    atsScore: 82,
    atsFeedback: ['Add cloud certs'],
    industryInsights: 'AI is booming',
    topSkills: ['Python', 'PyTorch'],
  },
  learningPath: [],
};

describe('History Unshift and Truncation Behavior', () => {
  it('truncates history to maximum 10 entries when unshifting', () => {
    let history: StoredAnalysis[] = [];

    // Push 15 items sequentially
    for (let i = 1; i <= 15; i++) {
      const entry: StoredAnalysis = {
        signature: `sig-${i}`,
        profile: { ...sampleProfile1, id: i },
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
      };
      history = [entry, ...history].slice(0, 10);
    }

    expect(history.length).toBe(10);
    // Newest entry should be sig-15 at index 0
    expect(history[0].signature).toBe('sig-15');
    // 10th entry should be sig-6 at index 9 (entries 1-5 pushed out)
    expect(history[9].signature).toBe('sig-6');
  });

  it('toHistorySummaryItem extracts lightweight summary without full profile payload', () => {
    const item: StoredAnalysis = {
      signature: 'test-signature-1',
      profile: sampleProfile1,
      createdAt: '2026-10-19T20:00:00.000Z',
    };

    const summary = toHistorySummaryItem(item, 0);
    expect(summary.index).toBe(0);
    expect(summary.signature).toBe('test-signature-1');
    expect(summary.createdAt).toBe('2026-10-19T20:00:00.000Z');
    expect(summary.roleTitle).toBe('Senior Frontend Engineer');
    expect(summary.focus).toBe('Senior Frontend Engineer');
    expect(summary.headline).toBe('Experienced Frontend specialist with deep React expertise.');
    expect(summary.topSkills).toEqual(['React', 'TypeScript', 'Node.js']);
    // Ensure large payload fields like technicalSkills or raw profile are omitted
    expect((summary as unknown as Record<string, unknown>).profile).toBeUndefined();
    expect((summary as unknown as Record<string, unknown>).technicalSkills).toBeUndefined();
  });
});

let currentSession: DashboardSessionData = {};
let currentUserId: string | null = 'user-123';

const testApp = new Hono<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>();

testApp.use('*', async (c, next) => {
  c.set('session', currentSession);
  c.set('userId', currentUserId);
  c.set('secure', false);
  await next();
});

testApp.route('/api/session/history', historyRoute);

describe('History Routes (/api/session/history)', () => {
  beforeEach(() => {
    mockKV.clear();
    vi.clearAllMocks();
    currentSession = {};
    currentUserId = 'user-123';
  });

  it('GET / returns lightweight list of past analyses in session', async () => {
    currentSession = {
      analysisHistory: [
        {
          signature: 'sig-1',
          profile: sampleProfile1,
          createdAt: '2026-10-19T10:00:00.000Z',
        },
        {
          signature: 'sig-2',
          profile: sampleProfile2,
          createdAt: '2026-10-19T09:00:00.000Z',
        },
      ],
    };

    const res = await testApp.request(
      '/api/session/history',
      { method: 'GET' },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { history: unknown[] };
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBe(2);
    expect(data.history[0]).toMatchObject({
      index: 0,
      signature: 'sig-1',
      roleTitle: 'Senior Frontend Engineer',
    });
    expect(data.history[1]).toMatchObject({
      index: 1,
      signature: 'sig-2',
      roleTitle: 'Data Scientist',
    });
  });

  it('GET / returns empty array when no history exists', async () => {
    currentSession = {};

    const res = await testApp.request(
      '/api/session/history',
      { method: 'GET' },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { history: unknown[] };
    expect(data.history).toEqual([]);
  });

  it('POST /restore restores valid entry by index and sets session cookie', async () => {
    const entry1: StoredAnalysis = {
      signature: 'sig-1',
      profile: sampleProfile1,
      createdAt: '2026-10-19T10:00:00.000Z',
    };
    const entry2: StoredAnalysis = {
      signature: 'sig-2',
      profile: sampleProfile2,
      createdAt: '2026-10-19T09:00:00.000Z',
    };

    currentSession = {
      analysis: entry1,
      analysisHistory: [entry1, entry2],
      preferences: { links: { github: 'https://github.com/alice' } },
    };

    const res = await testApp.request(
      '/api/session/history/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: 1 }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; restored: StoredAnalysis };
    expect(data.ok).toBe(true);
    expect(data.restored.signature).toBe('sig-2');
    expect(currentSession.analysis?.signature).toBe('sig-2');
    // Checks that session preference links are updated to bob's links
    expect(currentSession.preferences?.links?.github).toBe('https://github.com/bob');

    // Checks Set-Cookie header is returned
    const cookieHeader = res.headers.get('Set-Cookie');
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toContain('session=');
  });

  it('POST /restore restores valid entry by signature', async () => {
    const entry1: StoredAnalysis = {
      signature: 'sig-1',
      profile: sampleProfile1,
      createdAt: '2026-10-19T10:00:00.000Z',
    };
    const entry2: StoredAnalysis = {
      signature: 'sig-2',
      profile: sampleProfile2,
      createdAt: '2026-10-19T09:00:00.000Z',
    };

    currentSession = {
      analysis: entry1,
      analysisHistory: [entry1, entry2],
    };

    const res = await testApp.request(
      '/api/session/history/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: 'sig-2' }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    expect(currentSession.analysis?.signature).toBe('sig-2');
  });

  it('POST /restore returns 400 for out-of-range index', async () => {
    currentSession = {
      analysisHistory: [
        { signature: 'sig-1', profile: sampleProfile1, createdAt: '2026-10-19T10:00:00.000Z' },
      ],
    };

    const res = await testApp.request(
      '/api/session/history/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: 5 }),
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('History entry not found.');
  });

  it('POST /restore returns 400 for invalid signature', async () => {
    currentSession = {
      analysisHistory: [
        { signature: 'sig-1', profile: sampleProfile1, createdAt: '2026-10-19T10:00:00.000Z' },
      ],
    };

    const res = await testApp.request(
      '/api/session/history/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: 'unknown-signature' }),
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('History entry not found.');
  });

  it('POST /restore returns 400 for malformed JSON body', async () => {
    currentSession = { analysisHistory: [] };

    const res = await testApp.request(
      '/api/session/history/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Invalid JSON body.');
  });
});
