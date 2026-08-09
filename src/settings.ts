export interface UserSettings {
  modelsPath: string;
  sessionsDir: string;
  skillsDir: string;
  piPath: string;
}

const key = "pi-switch:settings";

export function loadSettings(): UserSettings {
  try {
    return { modelsPath: "", sessionsDir: "", skillsDir: "", piPath: "", ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return { modelsPath: "", sessionsDir: "", skillsDir: "", piPath: "" };
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(key, JSON.stringify(settings));
}
