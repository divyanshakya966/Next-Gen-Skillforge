export type ThemeMode = 'light' | 'dark';

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  resume?: string;
  twitter?: string;
  portfolio?: string;
  devto?: string;
}

export interface DashboardPreferences {
  theme?: ThemeMode;
  links?: Partial<SocialLinks>;
}

export interface StoredAnalysis {
  signature: string;
  profile: unknown;
  createdAt?: string;
}

export interface HistorySummaryItem {
  index: number;
  signature: string;
  createdAt: string;
  headline?: string;
  focus?: string;
  topSkills?: string[];
  roleTitle?: string;
}

export interface DashboardSessionData {
  preferences?: DashboardPreferences;
  analysis?: StoredAnalysis;
  analysisHistory?: StoredAnalysis[];
  resumeText?: string;
  resumeFileName?: string;
}
