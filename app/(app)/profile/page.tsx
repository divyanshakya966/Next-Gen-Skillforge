'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  apiGet,
  apiPost,
  apiPostForm,
} from '@/lib/api-client';
import type { SocialLinks } from '@/lib/types';
import {
  extractPdfText,
  isPdfFile,
  pdfTextToTxtFile,
  PdfExtractionError,
} from '@/lib/pdf-extract';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload,
  ExternalLink,
  Github,
  Linkedin,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LINK_FIELDS: Array<{
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'github',
    label: 'GitHub',
    placeholder: 'https://github.com/username',
    icon: <Github className="h-4 w-4" />,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/username',
    icon: <Linkedin className="h-4 w-4" />,
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    placeholder: 'https://yourportfolio.com',
    icon: <ExternalLink className="h-4 w-4" />,
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    placeholder: 'https://twitter.com/username',
    icon: <ExternalLink className="h-4 w-4" />,
  },
  {
    key: 'devto',
    label: 'Dev.to',
    placeholder: 'https://dev.to/username',
    icon: <ExternalLink className="h-4 w-4" />,
  },
  {
    key: 'resume',
    label: 'Resume URL',
    placeholder: 'https://example.com/resume.pdf',
    icon: <BookOpen className="h-4 w-4" />,
  },
];

const EMPTY_LINKS: SocialLinks = {
  github: '',
  linkedin: '',
  resume: '',
  twitter: '',
  portfolio: '',
  devto: '',
};

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [links, setLinks] = useState<SocialLinks>({ ...EMPTY_LINKS });
  const [errors, setErrors] = useState<Partial<Record<keyof SocialLinks, string>>>({});
  const [resumeFileName, setResumeFileName] = useState('');
  const resumeFileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const data = (await apiGet('/api/session/preferences')) as {
        theme?: string;
        links?: Partial<SocialLinks>;
        resumeFileName?: string | null;
      };
      if (data.links) {
        setLinks({ ...EMPTY_LINKS, ...data.links });
      }
      if (data.resumeFileName) {
        setResumeFileName(data.resumeFileName);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const isUrlValid = (value: string) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const validateLinks = (): boolean => {
    const newErrors: Partial<Record<keyof SocialLinks, string>> = {};
    let hasError = false;

    for (const field of LINK_FIELDS) {
      const value = links[field.key];
      if (value.trim() && !isUrlValid(value)) {
        newErrors[field.key] = 'Please enter a valid URL (https://...).';
        hasError = true;
      }
    }

    setErrors(newErrors);
    return !hasError;
  };

  const handleLinkChange = (key: keyof SocialLinks, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLinks()) {
      toast({
        title: 'Invalid links',
        description: 'Please fix the URL errors above before saving.',
        variant: 'destructive',
      });
      return;
    }

    const hasLinks = Object.values(links).some((v) => v.trim());
    if (!hasLinks) {
      toast({
        title: 'No links provided',
        description: 'Add at least one profile link to continue.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await apiPost('/api/session/preferences', { links });
      toast({
        title: 'Profile links saved',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save profile links.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLink = (key: keyof SocialLinks) => {
    setLinks((prev) => ({ ...prev, [key]: '' }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const handleResumeFile = async (file: File) => {
    setUploading(true);
    try {
      let uploadFile = file;
      if (isPdfFile(file)) {
        setExtracting(true);
        try {
          const text = await extractPdfText(file);
          uploadFile = pdfTextToTxtFile(text, file.name);
        } finally {
          setExtracting(false);
        }
      }

      const formData = new FormData();
      formData.append('resume', uploadFile);

      const response = (await apiPostForm('/api/resume/import', formData)) as {
        fileName?: string;
        resumeText?: string;
      };

      setResumeFileName(response.fileName || file.name);
      toast({
        title: 'Resume imported',
        description: response.fileName ? `Imported ${response.fileName}` : 'Resume uploaded.',
        variant: 'success',
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to import resume.';
      toast({
        title: error instanceof PdfExtractionError ? 'PDF import failed' : 'Import failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (resumeFileInputRef.current) {
        resumeFileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyze = async () => {
    if (!validateLinks()) return;
    const hasAnyLink = Object.values(links).some((v) => v.trim());
    if (!hasAnyLink && !resumeFileName) {
      toast({
        title: 'Nothing to analyze',
        description: 'Add at least one profile link or import a resume first.',
        variant: 'destructive',
      });
      return;
    }

    setAnalyzing(true);
    try {
      await apiPost('/api/session/preferences', { links });
      const response = (await apiPost('/api/analyze', {})) as {
        engine?: string;
        warnings?: Array<{ source: string; reason: string }>;
      };
      toast({
        title: 'Analysis complete',
        description: `Profile analyzed with the ${response.engine === 'ai' ? 'AI' : 'built-in'} engine.`,
        variant: 'success',
      });
      router.push('/analysis');
    } catch (error: any) {
      toast({
        title: 'Analysis failed',
        description: error?.message || 'Could not analyze your profile. Try again from the Analysis page.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Skeleton className="h-4 w-1/3" />
          {LINK_FIELDS.map((field) => (
            <Skeleton key={field.key} className="h-10 w-full" />
          ))}
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </div>
    );
  }

  const hasAnyLink = Object.values(links).some((v) => v.trim());
  const completedLinks = Object.values(links).filter((v) => v.trim()).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="text-muted-foreground">
            Connect your professional profiles and resume for analysis.
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={!hasAnyLink || saving || analyzing} className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Save & Analyze'}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-bold text-lg mb-2">Profile Links</h2>
                <p className="text-sm text-muted-foreground">
                  Add public URLs so Skillforge can analyze your skills and experience.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {LINK_FIELDS.map((field) => {
                  const error = errors[field.key];
                  const isResume = field.key === 'resume';
                  return (
                    <div key={field.key} className="flex flex-col gap-2">
                      {isResume ? (
                        <div className="relative flex items-stretch gap-2">
                          <Input
                            id={field.key}
                            label={field.label}
                            value={links[field.key]}
                            onChange={(e) => handleLinkChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            leftIcon={field.icon}
                            error={error}
                            disabled={uploading}
                            className={`pl-9 ${uploading ? 'pr-40' : 'pr-24'}`}
                            rightAction={
                              <Button
                                type="button"
                                onClick={() => resumeFileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors disabled:opacity-50 disabled:pointer-events-none border-accent/40 bg-accent/10 text-accent" //og
                                aria-label="Import resume file"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {extracting ? 'Extracting text...' : uploading ? 'Importing...' : 'Import'}
                              </Button>
                            }
                            />
                          <input
                            ref={resumeFileInputRef}
                            type="file"
                            accept=".txt,text/plain,.pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleResumeFile(file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </div>
                      ) : (
                        <Input
                          id={field.key}
                          label={field.label}
                          value={links[field.key]}
                          onChange={(e) => handleLinkChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          leftIcon={field.icon}
                          error={error}
                        />
                      )}
                      {error && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(field.key)}
                          className="mt-1 p-1.5 text-destructive hover:bg-destructive/10 rounded"
                          aria-label="Clear field"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {resumeFileName && (
                <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Resume: {resumeFileName}</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Resume import accepts plain-text (.txt) and PDF files up to 8MB. PDF text is
                extracted in your browser. DOCX is not supported.
              </p>

              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  {completedLinks} of {LINK_FIELDS.length} links added
                </span>
                <Badge variant="default" className="text-xs px-2 py-1">
                  {completedLinks} saved
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Links are saved to your browser session and used for analysis.
          </p>
          <Button type="submit" disabled={saving || !hasAnyLink}>
            {saving ? 'Saving...' : 'Save Profile Links'}
          </Button>
        </div>
      </form>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading font-bold text-lg mb-4">Next steps</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent" />
            <p className="text-sm text-foreground">
              Once links are saved, go to <Link href="/analysis" className="text-primary underline">Analysis</Link> to run AI profile analysis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              After analysis, visit <Link href="/learning" className="text-primary underline">Learning Path</Link> for your personalized roadmap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}