'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiGet, apiDelete } from '@/lib/api-client';
import type { UserProfile } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressWithLabel } from '@/components/ui/progress';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  TrendingUp,
  FileText,
  BarChart3,
  Users,
  RefreshCw,
  AlertCircle,
  Upload,
  Download,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>('light');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSeqRef = useRef(0);
  const clearButtonContainerRef = useRef<HTMLDivElement | null>(null);
  const confirmGroupRef = useRef<HTMLDivElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    const readTheme = () => {
      setUiTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (confirmingDelete) {
      confirmGroupRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (shouldRestoreFocusRef.current) {
      clearButtonContainerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      shouldRestoreFocusRef.current = false;
    }
  }, [confirmingDelete]);

  const fetchSession = useCallback(async (): Promise<boolean> => {
    const seq = ++fetchSeqRef.current;
    const analysisResp = await apiGet('/api/session/analysis');
    if (seq !== fetchSeqRef.current) return false;

    const analysis = (analysisResp as {
      analysis?: { profile?: UserProfile } | null;
      stale?: boolean;
    })?.analysis;

    if (analysis?.profile) {
      setSavedProfile(analysis.profile);
    } else {
      setSavedProfile(null);
    }
    return true;
  }, []);

  useEffect(() => {
    fetchSession()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchSession]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const applied = await fetchSession();
      if (!applied) return;
      toast({
        title: 'Session refreshed',
        description: 'Your latest data has been loaded.',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Refresh failed',
        description: 'Unable to load session data.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    shouldRestoreFocusRef.current = true;
    setConfirmingDelete(false);
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiDelete('/api/session/analysis');
      fetchSeqRef.current += 1;
      setSavedProfile(null);
      setConfirmingDelete(false);
      shouldRestoreFocusRef.current = false;
      toast({
        title: 'Analysis cleared',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Clear failed',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const profile = savedProfile;
  const hasAnalysis = !!profile;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, analysis, and career roadmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={refreshing || deleting}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={refreshing ? 'animate-spin h-4 w-4' : 'h-4 w-4'} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Industry Relevance
              </p>
              <p className="text-3xl font-bold">
                {profile?.aiSummary.industryRelevanceScore ?? 0}%
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <ProgressWithLabel
              value={profile?.aiSummary.industryRelevanceScore ?? 0}
              label="Industry demand match"
              showValue={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                ATS Score
              </p>
              <p className="text-3xl font-bold">
                {profile?.aiSummary.atsScore ?? (profile ? 0 : '—')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <ProgressWithLabel
              value={profile?.aiSummary.atsScore ?? 0}
              label={profile ? 'Resume ATS readiness' : 'Upload a resume'}
              showValue={false}
              color="accent"
            />
            {!profile && (
              <p className="mt-2 text-xs text-muted-foreground">
                Upload a resume to generate ATS scoring.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Technical Skills
              </p>
              <p className="text-3xl font-bold">
                {profile?.technicalSkills.length ?? 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Skills detected from your profile
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Soft Skills
              </p>
              <p className="text-3xl font-bold">
                {profile?.softSkills.length ?? 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Communication & interpersonal skills
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <Card className="sm:col-span-2">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-bold">Quick Actions</h2>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/profile"
                className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Setup Profile
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/analysis"
                className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  View Analysis
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/report"
                className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Report
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-lg font-bold">Session</h2>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Theme</span>
              <Badge variant="default" className="text-xs px-2 py-1">
                {uiTheme === 'dark' ? 'Dark' : 'Light'}
              </Badge>
            </div>
            {hasAnalysis && (
              !confirmingDelete ? (
                <div ref={clearButtonContainerRef}>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                    className="w-full"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Clear Analysis
                  </Button>
                </div>
              ) : (
                <div
                  ref={confirmGroupRef}
                  role="group"
                  aria-labelledby="clear-analysis-confirm-label"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelDelete();
                    }
                  }}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-3"
                >
                  <p id="clear-analysis-confirm-label" className="text-xs text-muted-foreground font-medium">
                    Are you sure? This will delete your saved analysis.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConfirmDelete}
                      isLoading={deleting}
                      disabled={deleting}
                      className="flex-1"
                    >
                      Yes, Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelDelete}
                      disabled={deleting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {hasAnalysis && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-bold">AI Summary</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {profile.aiSummary.overview || 'No summary available.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.aiSummary.topSkills.slice(0, 5).map((skill) => (
                  <Badge key={skill} variant="default" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-bold">Job Matches</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-bold mb-2">{profile.jobRecommendations.length}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Opportunities matched to your profile.
              </p>
              <Link
                href="/analysis"
                className="text-sm font-medium text-primary underline"
              >
                View all recommendations →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-bold">Learning Path</h2>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-bold mb-2">{profile.learningPath.length}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Steps to close your skill gaps.
              </p>
              <Link
                href="/learning"
                className="text-sm font-medium text-primary underline"
              >
                View learning path →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasAnalysis && (
        <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-secondary/50 mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No analysis yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Connect your profiles or upload a resume to get AI-powered skill analysis,
            job recommendations, and a personalized learning path.
          </p>
          <Link
            href="/profile"
            className="inline-flex h-10 items-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-hover transition-colors px-4"
          >
            Set up profile <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}