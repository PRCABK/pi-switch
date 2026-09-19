import { invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  CatalogModel,
  CommandResult,
  InstalledPackage,
  ModelConfig,
  ModelConfigFile,
  PackageGalleryItem,
  ProviderModel,
  SessionDetail,
  SessionList,
  SessionSummary,
  SkillCatalog,
  SkillInfo,
  UsageStats,
} from "./types";

export const api = {
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  readModelConfig: (path?: string) => invoke<ModelConfigFile>("read_model_config", { path }),
  saveModelConfig: (config: ModelConfig, path?: string) =>
    invoke<string | null>("save_model_config", { path, config }),
  searchCatalog: (name: string, provider?: string) =>
    invoke<CatalogModel[]>("search_catalog", { name, provider }),
  fetchCatalogConfig: (detailPath: string) =>
    invoke<ModelConfig>("fetch_catalog_config", { detailPath }),
  fetchProviderModels: (
    baseUrl: string,
    apiKey?: string,
    headers?: Record<string, string>,
    authHeader?: boolean,
  ) => invoke<ProviderModel[]>("fetch_provider_models", { baseUrl, apiKey, headers, authHeader }),
  listSessions: (sessionsDir?: string) =>
    invoke<SessionList>("list_sessions", { sessionsDir }),
  getSessionDetail: (sessionPath: string, sessionsDir?: string) =>
    invoke<SessionDetail>("get_session_detail", { sessionPath, sessionsDir }),
  getUsageStats: (sessionsDir?: string) =>
    invoke<UsageStats>("get_usage_stats", { sessionsDir }),
  listSkills: (skillsDir?: string) =>
    invoke<SkillCatalog>("list_skills", { skillsDir }),
  installSkill: (sourcePath: string, skillsDir?: string) =>
    invoke<SkillInfo>("install_skill", { sourcePath, skillsDir }),
  setSkillEnabled: (skillId: string, enabled: boolean, skillsDir?: string) =>
    invoke<void>("set_skill_enabled", { skillId, enabled, skillsDir }),
  uninstallSkill: (skillId: string, enabled: boolean, skillsDir?: string) =>
    invoke<void>("uninstall_skill", { skillId, enabled, skillsDir }),
  renameSession: (sessionPath: string, name: string, sessionsDir?: string) =>
    invoke<void>("rename_session", { sessionPath, name, sessionsDir }),
  deleteSession: (sessionPath: string, sessionsDir?: string) =>
    invoke<void>("delete_session", { sessionPath, sessionsDir }),
  continueSession: (sessionId: string, cwd?: string, piPath?: string) =>
    invoke<void>("continue_session", { sessionId, cwd, piPath }),
  exportSession: (sessionPath: string, piPath?: string, sessionsDir?: string) =>
    invoke<CommandResult>("export_session", { sessionPath, piPath, sessionsDir }),
  validateModels: (piPath?: string) =>
    invoke<CommandResult>("validate_models", { piPath }),
  listPackages: (piPath?: string) =>
    invoke<InstalledPackage[]>("list_packages", { piPath }),
  installPackage: (source: string, piPath?: string) =>
    invoke<CommandResult>("install_package", { source, piPath }),
  removePackage: (source: string, piPath?: string) =>
    invoke<CommandResult>("remove_package", { source, piPath }),
  updatePackages: (piPath?: string) =>
    invoke<CommandResult>("update_packages", { piPath }),
  searchPackages: (name?: string) =>
    invoke<PackageGalleryItem[]>("search_packages", { name }),
};
