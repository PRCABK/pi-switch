export interface AppInfo {
  agentDir: string;
  modelsPath: string;
  sessionsDir: string;
  skillsDir: string;
  piVersion?: string;
}

export interface ModelConfigFile {
  path: string;
  exists: boolean;
  config: ModelConfig;
}

export interface ModelConfig {
  providers: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CatalogModel {
  name: string;
  id: string;
  provider: string;
  detailPath: string;
  contextWindow: string;
}

export interface SessionSummary {
  id: string;
  name?: string;
  cwd: string;
  path: string;
  createdAt: string;
  modifiedAt: string;
  firstMessage: string;
  model?: string;
  provider?: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface DisplayEntry {
  id: string;
  parentId?: string;
  entryType: string;
  timestamp: string;
  active: boolean;
  role?: string;
  title: string;
  text: string;
  thinking?: string;
  toolName?: string;
  isError: boolean;
  provider?: string;
  model?: string;
}

export interface SessionDetail {
  summary: SessionSummary;
  entries: DisplayEntry[];
}

export interface CommandResult {
  success: boolean;
  output: string;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  fileCount: number;
  modifiedAt: string;
}

export interface SkillCatalog {
  skillsDir: string;
  disabledDir: string;
  skills: SkillInfo[];
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCost: number;
  requests: number;
  messages: number;
  sessions: number;
}

export interface DailyUsage {
  date: string;
  totalTokens: number;
  totalCost: number;
  requests: number;
  sessions: number;
}

export interface UsageBreakdown {
  name: string;
  totalTokens: number;
  totalCost: number;
  requests: number;
}

export interface UsageStats {
  totals: UsageTotals;
  today: UsageTotals;
  daily: DailyUsage[];
  models: UsageBreakdown[];
  providers: UsageBreakdown[];
}
