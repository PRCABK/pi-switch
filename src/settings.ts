export interface UserSettings {
  modelsPath: string;
  sessionsDir: string;
  piPath: string;
}

const key = "pi-switch:settings";

export function loadSettings(): UserSettings {
  try {
    return { modelsPath: "", sessionsDir: "", piPath: "", ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return { modelsPath: "", sessionsDir: "", piPath: "" };
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(key, JSON.stringify(settings));
}
