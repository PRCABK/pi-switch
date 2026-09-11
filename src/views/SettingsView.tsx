import { useEffect, useState } from "react";
import { FolderCog, RefreshCw, RotateCcw, Save, Terminal } from "lucide-react";
import { api } from "../api";
import { loadSettings, saveSettings, type UserSettings } from "../settings";
import type { AppInfo } from "../types";
import { errorText } from "../lib/format";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Descriptions } from "../components/ui/descriptions";
import { Field, Input } from "../components/ui/input";
import { Page } from "../components/ui/page";
import { Panel, PanelBody, PanelHeader } from "../components/ui/panel";
import { toast } from "../components/ui/feedback";

// 持久化缓存：首次加载后写入 localStorage，应用重启后直接读缓存，不再重新请求
const INFO_CACHE_KEY = "pi-switch:env-info";

function readCachedInfo(): AppInfo | null {
  try {
    const raw = localStorage.getItem(INFO_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppInfo) : null;
  } catch {
    return null;
  }
}

function cacheInfo(result: AppInfo) {
  try {
    localStorage.setItem(INFO_CACHE_KEY, JSON.stringify(result));
  } catch {
    /* 忽略写入失败 */
  }
}

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  async function loadInfo(force = false) {
    if (!force) {
      const cached = readCachedInfo();
      if (cached?.skillsDir) {
        setInfo(cached);
        return;
      }
    }
    setInfoLoading(true);
    try {
      const result = await api.getAppInfo();
      setInfo(result);
      cacheInfo(result);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setInfoLoading(false);
    }
  }

  useEffect(() => {
    void loadInfo();
  }, []);

  function save() {
    saveSettings({ ...settings });
    toast.success("设置已保存，重新打开页面后生效");
  }

  function reset() {
    const next: UserSettings = { ...settings, modelsPath: "", sessionsDir: "", skillsDir: "", piPath: "" };
    setSettings(next);
    saveSettings(next);
    toast.success("设置已保存，重新打开页面后生效");
  }

  return (
    <Page title="应用设置" subtitle="配置 Pi 可执行文件和数据目录">
      <Panel className="max-w-[820px]">
        <PanelHeader>
          <h2>
            <FolderCog size={15} />
            路径设置
          </h2>
          <span className="panel-index">01 / CONFIG</span>
        </PanelHeader>
        <PanelBody>
          <Alert className="mb-5">留空时使用 Pi 的默认位置。路径只保存在本机 WebView 的 localStorage 中。</Alert>
          <Field label="Pi 可执行文件">
            <Input
              value={settings.piPath}
              placeholder={info?.piVersion ? `pi（检测到 ${info.piVersion}）` : "pi 或完整路径"}
              onChange={(event) => setSettings((prev) => ({ ...prev, piPath: event.target.value }))}
            />
          </Field>
          <Field label="models.json 路径">
            <Input
              value={settings.modelsPath}
              placeholder={info?.modelsPath || "~/.pi/agent/models.json"}
              onChange={(event) => setSettings((prev) => ({ ...prev, modelsPath: event.target.value }))}
            />
          </Field>
          <Field label="Sessions 目录">
            <Input
              value={settings.sessionsDir}
              placeholder={info?.sessionsDir || "~/.pi/agent/sessions"}
              onChange={(event) => setSettings((prev) => ({ ...prev, sessionsDir: event.target.value }))}
            />
          </Field>
          <Field label="Skills 目录" className="mb-0">
            <Input
              value={settings.skillsDir}
              placeholder={info?.skillsDir || "~/.pi/agent/skills"}
              onChange={(event) => setSettings((prev) => ({ ...prev, skillsDir: event.target.value }))}
            />
          </Field>
          <div className="toolbar mt-[18px]">
            <Button variant="primary" icon={Save} onClick={save}>
              保存设置
            </Button>
            <Button icon={RotateCcw} onClick={reset}>
              恢复默认
            </Button>
          </div>
        </PanelBody>
      </Panel>

      {info ? (
        <Panel className="mt-[18px] max-w-[820px]">
          <PanelHeader>
            <h2>
              <Terminal size={15} />
              环境信息
            </h2>
            <div className="toolbar">
              <span className="panel-index">RUNTIME</span>
              <Button size="sm" icon={RefreshCw} loading={infoLoading} onClick={() => void loadInfo(true)}>
                重新加载
              </Button>
            </div>
          </PanelHeader>
          <PanelBody>
            <Descriptions
              items={[
                { label: "Pi 版本", children: info.piVersion || "未检测到" },
                { label: "Agent 目录", children: <span className="font-mono">{info.agentDir}</span> },
                { label: "默认模型配置", children: <span className="font-mono">{info.modelsPath}</span> },
                { label: "默认对话目录", children: <span className="font-mono">{info.sessionsDir}</span> },
                { label: "默认 Skill 目录", children: <span className="font-mono">{info.skillsDir}</span> },
              ]}
            />
          </PanelBody>
        </Panel>
      ) : null}
    </Page>
  );
}
