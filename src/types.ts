export interface AppInfo {
  agentDir: string;
  modelsPath: string;
  sessionsDir: string;
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
