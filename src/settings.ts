export interface UserSettings {
  modelsPath: string;
  sessionsDir: string;
  skillsDir: string;
  piPath: string;
  /** 关闭行为偏好：null = 每次询问，"tray" = 最小化到托盘，"quit" = 直接退出 */
  closeAction: "tray" | "quit" | null;
}

const key = "pi-switch:settings";

export function loadSettings(): UserSettings {
  try {
    return {
      modelsPath: "",
      sessionsDir: "",
      skillsDir: "",
      piPath: "",
      closeAction: null,
      ...JSON.parse(localStorage.getItem(key) || "{}"),
    };
  } catch {
    return { modelsPath: "", sessionsDir: "", skillsDir: "", piPath: "", closeAction: null };
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(key, JSON.stringify(settings));
}
