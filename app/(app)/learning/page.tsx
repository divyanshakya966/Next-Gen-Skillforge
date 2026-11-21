'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiGet } from '@/lib/api-client';
import type { UserProfile, LearningPathItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import Link from 'next/link';
import { filterLearningPath, learningPriorityCounts, type PriorityFilter } from '@/lib/learning-priority';
import {
  BookOpen,
  Play,
  FileText,
  Monitor,
  RefreshCw,
} from 'lucide-react';

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  course: <Play className="h-4 w-4" />,
  book: <BookOpen className="h-4 w-4" />,
  video: <Monitor className="h-4 w-4" />,
  documentation: <FileText className="h-4 w-4" />,
};

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  high: {
    label: 'High Priority',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  medium: {
    label: 'Medium',
    className: 'text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/40',
  },
  low: {
    label: 'Low Priority',
    className: 'text-accent bg-accent/10 border-accent/20',
  },
};

const PRIORITY_FALLBACK = {
  label: 'Priority',
  className: 'text-muted-foreground bg-secondary border-border',
};

export default function LearningPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const fetchAnalysis = useCallback(async () => {
    try {
      const data = (await apiGet('/api/session/analysis')) as {
        analysis?: { profile?: UserProfile } | null;
      };
      setProfile(data.analysis?.profile ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAnalysis();
      toast({ title: 'Learning path refreshed', variant: 'success' });
    } catch {
      toast({ title: 'Refresh failed', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const path = (profile?.learningPath ?? []) as LearningPathItem[];

  if (!profile || path.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-secondary/50 mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg mb-2">No learning path yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Run profile analysis first to get a personalized learning roadmap.
            </p>
            <Link
              href="/analysis"
              className="inline-flex h-10 items-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-hover transition-colors px-4"
            >
              Go to Analysis
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalItems = path.length;
  const counts = learningPriorityCounts(path);
  const highPriority = counts.high;
  const visiblePath = filterLearningPath(path, priorityFilter);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Learning Path</h1>
          <p className="text-muted-foreground">
            Your personalized roadmap to close skill gaps.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Topics</p>
            <p className="text-3xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">High Priority</p>
            <p className="text-3xl font-bold text-destructive">{highPriority}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Difficulty</p>
            <p className="text-3xl font-bold">
              {highPriority > totalItems / 2 ? 'Hard' : highPriority > 0 ? 'Medium' : 'Easy'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div role="group" aria-label="Filter learning path by priority" className="mb-6 flex flex-wrap gap-2">
        {(['all', 'high', 'medium', 'low'] as const).map((priority) => (
          <button
            key={priority}
            type="button"
            aria-pressed={priorityFilter === priority}
            aria-controls="learning-path-items"
            onClick={() => setPriorityFilter(priority)}
            className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              priority === 'all' ? 'border-border bg-secondary text-foreground' : PRIORITY_STYLES[priority].className
            } ${priorityFilter === priority ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
          >
            {priority === 'all' ? 'All' : priority[0].toUpperCase() + priority.slice(1)} ({counts[priority]})
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">Showing {visiblePath.length} of {totalItems} learning topics</p>
      <div id="learning-path-items" className="space-y-4">
        {visiblePath.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            No {priorityFilter}-priority items in this learning path. Choose All to see every topic.
          </CardContent></Card>
        )}
        {visiblePath.map((item) => {
          const config = PRIORITY_STYLES[item.priority] ?? PRIORITY_FALLBACK;
          return (
            <Card key={item.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-heading font-bold text-base group-hover:text-primary transition-colors">
                    {item.topic}
                  </h4>
                  <Badge variant="outline" className={`text-[10px] px-2 py-1 ${config.className}`}>
                    {config.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {item.explanation}
                </p>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item.timeEstimate}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Resources ({item.resources.length})
                  </p>
                  {item.resources.map((resource, i) => (
                    <a
                      key={i}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="flex items-center gap-1.5 truncate min-w-0">
                        {RESOURCE_ICONS[resource.type] || <FileText className="h-3.5 w-3.5" />}
                        {resource.title}
                        {resource.provider && ` · ${resource.provider}`}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase opacity-70">
                        {resource.free ? 'Free' : 'Paid'}
                      </span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          All resources are curated based on your skill gaps and industry demand.
        </p>
        <Link
          href="/analysis"
          className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          Back to Analysis
        </Link>
      </div>
    </div>
  );
}
