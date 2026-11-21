import type { LearningPathItem } from './types';

export type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

export function learningPriorityCounts(path: LearningPathItem[]): Record<PriorityFilter, number> {
  return {
    all: path.length,
    high: path.filter((item) => item.priority === 'high').length,
    medium: path.filter((item) => item.priority === 'medium').length,
    low: path.filter((item) => item.priority === 'low').length,
  };
}

export function filterLearningPath(path: LearningPathItem[], priority: PriorityFilter) {
  return priority === 'all' ? path : path.filter((item) => item.priority === priority);
}
