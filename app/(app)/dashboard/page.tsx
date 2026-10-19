'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiGet, apiDelete, apiPost } from '@/lib/api-client';
import type { UserProfile, HistorySummaryItem } from '@/lib/types';
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
  History,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'recently';
  const timestamp = new Date(dateString).getTime();
  if (isNaN(timestamp)) return 'recently';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [historyItems, setHistoryItems] = useState<HistorySummaryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const readTheme = () => {
      setUiTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const fetchSession = useCallback(async () => {
    const [analysisResp, historyResp] = await Promise.all([
      apiGet('/api/session/analysis').catch(() => null),
      apiGet('/api/session/history').catch(() => null),
    ]);

    const analysis = (analysisResp as {
      analysis?: { profile?: UserProfile } | null;
      stale?: boolean;
    })?.analysis;

    if (analysis?.profile) {
      setSavedProfile(analysis.profile);
    } else {
      setSavedProfile(null);
    }

    const historyData = (historyResp as { history?: HistorySummaryItem[] })?.history;
    if (Array.isArray(historyData)) {
      setHistoryItems(historyData);
    } else {
      setHistoryItems([]);
    }
  }, []);

  const handleRestoreAnalysis = async (index: number) => {
    setRestoringIndex(index);
    try {
      await apiPost('/api/session/history/restore', { index });
      toast({
        title: 'Analysis restored',
        description: 'Switched to selected past analysis. Redirecting...',
        variant: 'success',
      });
      router.push('/analysis');
    } catch {
      toast({
        title: 'Restore failed',
        description: 'Unable to restore this analysis entry.',
        variant: 'destructive',
      });
      setRestoringIndex(null);
    }
  };

  useEffect(() => {
    fetchSession()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchSession]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSession();
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

  const handleDeleteAnalysis = async () => {
    try {
      await apiDelete('/api/session/analysis');
      setSavedProfile(null);
      toast({
        title: 'Analysis cleared',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Clear failed',
        variant: 'destructive',
      });
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
            disabled={refreshing}
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
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAnalysis}
                className="w-full"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Clear Analysis
              </Button>
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
        <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center mb-8">
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

      {/* Analysis History Section */}
      <div className="mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Analysis History</h2>
                <p className="text-xs text-muted-foreground">
                  Browse or restore up to 10 past analyses from your session
                </p>
              </div>
            </div>
            {historyItems.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {historyItems.length} {historyItems.length === 1 ? 'saved run' : 'saved runs'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {historyItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <Clock className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p>No previous analysis history saved yet.</p>
                <p className="text-xs mt-1">Past runs will appear here automatically when you analyze your profile.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {historyItems.map((item) => (
                  <div
                    key={`${item.index}-${item.createdAt}`}
                    className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/30 px-2 rounded-md transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">
                          {item.roleTitle || item.focus || `Analysis #${item.index + 1}`}
                        </span>
                        {item.index === 0 && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                            Latest
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 inline" />
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      {item.headline && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                          {item.headline}
                        </p>
                      )}
                      {item.topSkills && item.topSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.topSkills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreAnalysis(item.index)}
                        disabled={restoringIndex !== null}
                        className="text-xs flex items-center gap-1.5"
                      >
                        {restoringIndex === item.index ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}