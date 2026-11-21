import { describe, expect, it } from 'vitest';
import { filterLearningPath, learningPriorityCounts } from '@/lib/learning-priority';
import type { LearningPathItem } from '@/lib/types';

const item = (id: number, priority: LearningPathItem['priority']): LearningPathItem => ({
  id, priority, topic: String(id), explanation: 'A topic', timeEstimate: '1 hour', resources: [],
});

describe('learning priority filters', () => {
  const path = [item(1, 'low'), item(2, 'high'), item(3, 'medium'), item(4, 'high')];
  it('counts every priority independently of the selected view', () => {
    expect(learningPriorityCounts(path)).toEqual({ all: 4, high: 2, medium: 1, low: 1 });
    expect(filterLearningPath(path, 'all')).toBe(path);
  });
  it.each(['high', 'medium', 'low'] as const)('selects %s items without mutating order or source', (priority) => {
    const before = JSON.stringify(path);
    const expectedIds = { high: [2, 4], medium: [3], low: [1] };
    expect(filterLearningPath(path, priority).map((entry) => entry.id)).toEqual(expectedIds[priority]);
    expect(JSON.stringify(path)).toBe(before);
  });
  it('supports empty selections and recomputes counts after a refreshed path', () => {
    expect(filterLearningPath([path[0]], 'high')).toEqual([]);
    expect(learningPriorityCounts([])).toEqual({ all: 0, high: 0, medium: 0, low: 0 });
    expect(learningPriorityCounts([path[0]])).toEqual({ all: 1, high: 0, medium: 0, low: 1 });
  });
});
