import { useEffect, useMemo, useState } from "react";
import { FolderInput, PackagePlus, Power, PowerOff, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { SkillCatalog, SkillInfo } from "../types";
import { errorText, formatDate } from "../lib/format";
import { cn } from "../lib/utils";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { confirmDialog, toast } from "../components/ui/feedback";
import { Field, Input } from "../components/ui/input";
import { Page } from "../components/ui/page";
import { Panel } from "../components/ui/panel";
import { Segmented } from "../components/ui/segmented";
import { Tag } from "../components/ui/tag";
import { LoadingOverlay } from "../components/ui/spinner";

type SkillFilter = "all" | "enabled" | "disabled";

export default function SkillsView() {
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [catalog, setCatalog] = useState<SkillCatalog | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [sourcePath, setSourcePath] = useState("");

  const filteredSkills = useMemo(() => {
    const skills = catalog?.skills ?? [];
    if (filter === "enabled") return skills.filter((skill) => skill.enabled);
    if (filter === "disabled") return skills.filter((skill) => !skill.enabled);
    return skills;
  }, [catalog, filter]);

  const enabledCount = catalog?.skills.filter((skill) => skill.enabled).length ?? 0;
  const disabledCount = catalog?.skills.filter((skill) => !skill.enabled).length ?? 0;

  async function loadSkills() {
    setLoading(true);
    try {
      setCatalog(await api.listSkills(loadSettings().skillsDir || undefined));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, []);

  async function installSkill() {
    if (!sourcePath.trim()) {
      toast.warning("请输入 Skill 目录路径");
      return;
    }
    setInstallLoading(true);
    try {
      const skill = await api.installSkill(sourcePath.trim(), loadSettings().skillsDir || undefined);
      setInstallVisible(false);
      setSourcePath("");
      await loadSkills();
      toast.success(`已安装 ${skill.name}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setInstallLoading(false);
    }
  }

  async function toggleSkill(skill: SkillInfo) {
    setActionId(skill.id);
    try {
      await api.setSkillEnabled(skill.id, !skill.enabled, loadSettings().skillsDir || undefined);
      await loadSkills();
      toast.success(skill.enabled ? `已停用 ${skill.name}` : `已启用 ${skill.name}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setActionId("");
    }
  }

  async function uninstallSkill(skill: SkillInfo) {
    const confirmed = await confirmDialog({
      title: "卸载 Skill",
      message: `将永久删除 Skill “${skill.name}” 及其目录中的全部文件，是否继续？`,
      confirmText: "卸载",
    });
    if (!confirmed) return;
    setActionId(skill.id);
    try {
      await api.uninstallSkill(skill.id, skill.enabled, loadSettings().skillsDir || undefined);
      await loadSkills();
      toast.success(`已卸载 ${skill.name}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setActionId("");
    }
  }

  return (
    <Page
      title="Skill 管理"
      subtitle="安装、停用和维护 Pi Agent 的本地能力扩展"
      actions={
        <>
          <Button icon={RefreshCw} loading={loading} onClick={() => void loadSkills()}>
            刷新
          </Button>
          <Button variant="primary" icon={PackagePlus} onClick={() => setInstallVisible(true)}>
            安装 Skill
          </Button>
        </>
      }
    >
      {catalog ? (
        <>
          <Alert>
            启用目录：<span className="font-mono">{catalog.skillsDir}</span>
            <span className="mx-1.5" />
            停用目录：<span className="font-mono">{catalog.disabledDir}</span>
          </Alert>

          <div className="my-4 flex items-center gap-6 rounded-md border border-line bg-panel px-4 py-[13px] shadow-sm max-[600px]:flex-wrap max-[600px]:gap-x-[18px] max-[600px]:gap-y-3">
            <div className="flex items-center gap-[7px]">
              <span className="h-[7px] w-[7px] rounded-full bg-success shadow-[0_0_0_3px_rgba(21,128,61,0.12)]" />
              <strong className="text-title tabular-nums text-ink">{enabledCount}</strong>
              <small className="text-[10px] text-ink-3">已启用</small>
            </div>
            <div className="flex items-center gap-[7px]">
              <span className="h-[7px] w-[7px] rounded-full bg-ink-3 shadow-[0_0_0_3px_rgba(9,9,11,0.06)]" />
              <strong className="text-title tabular-nums text-ink">{disabledCount}</strong>
              <small className="text-[10px] text-ink-3">已停用</small>
            </div>
            <Segmented
              value={filter}
              onChange={setFilter}
              className="ml-auto max-[600px]:ml-0 max-[600px]:w-full"
              options={[
                { value: "all", label: `全部 ${catalog.skills.length}` },
                { value: "enabled", label: "已启用" },
                { value: "disabled", label: "已停用" },
              ]}
            />
          </div>

          <div className="relative grid grid-cols-3 gap-3.5 max-[1250px]:grid-cols-2 max-[600px]:grid-cols-1">
            <LoadingOverlay visible={loading} className="z-20" />
            {filteredSkills.map((skill, index) => (
              <article
                key={`${skill.enabled}-${skill.id}`}
                style={{ animationDelay: `${(index + 1) * 30}ms` }}
                className={cn(
                  "relative flex min-h-[250px] min-w-0 animate-card-in flex-col overflow-hidden rounded-lg border border-line bg-panel p-4 shadow-sm",
                  "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:shadow-popover",
                  !skill.enabled && "bg-muted",
                )}
              >
                <div className="relative z-[1] flex items-start justify-between">
                  <div
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md border border-line bg-muted text-accent",
                      !skill.enabled && "opacity-60",
                    )}
                  >
                    <Puzzle size={19} strokeWidth={1.7} />
                  </div>
                  <Tag tone={skill.enabled ? "success" : "default"}>{skill.enabled ? "已启用" : "已停用"}</Tag>
                </div>
                <div className={cn("relative z-[1] mt-3.5", !skill.enabled && "opacity-60")}>
                  <h2 className="m-0 truncate text-title font-[650] text-ink">{skill.name}</h2>
                  <p className="mt-[7px] mb-0 line-clamp-3 min-h-[42px] overflow-hidden text-[11px] leading-[1.45] text-ink-2">
                    {skill.description || "此 Skill 没有提供描述。"}
                  </p>
                </div>
                <div className="mt-3 flex justify-between gap-2.5 text-[9px] text-ink-3">
                  <span>{skill.fileCount} 个文件</span>
                  <span>更新于 {formatDate(skill.modifiedAt)}</span>
                </div>
                <div className="mt-[9px] truncate font-mono text-[8px] text-ink-3" title={skill.path}>
                  {skill.path}
                </div>
                <div className="mt-auto flex gap-2 border-t border-line pt-[13px]">
                  <Button
                    size="sm"
                    className="flex-1"
                    icon={skill.enabled ? PowerOff : Power}
                    loading={actionId === skill.id}
                    onClick={() => void toggleSkill(skill)}
                  >
                    {skill.enabled ? "停用" : "启用"}
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerPlain"
                    className="flex-1"
                    icon={Trash2}
                    disabled={actionId === skill.id}
                    onClick={() => void uninstallSkill(skill)}
                  >
                    卸载
                  </Button>
                </div>
              </article>
            ))}

            {filteredSkills.length ? null : (
              <Panel className="col-span-full grid min-h-[300px] place-items-center">
                <div className="empty-state flex flex-col items-center justify-center">
                  <strong className="text-control text-ink">
                    {catalog.skills.length ? "当前筛选下没有 Skill" : "还没有安装 Skill"}
                  </strong>
                  <span className="mt-1.5 block">
                    {catalog.skills.length
                      ? "切换筛选条件查看其他状态。"
                      : "从包含 SKILL.md 的本地目录安装第一个 Skill。"}
                  </span>
                </div>
              </Panel>
            )}
          </div>
        </>
      ) : null}

      <Dialog
        open={installVisible}
        onOpenChange={setInstallVisible}
        title="从本地目录安装 Skill"
        footer={
          <>
            <Button onClick={() => setInstallVisible(false)}>取消</Button>
            <Button variant="primary" icon={PackagePlus} loading={installLoading} onClick={() => void installSkill()}>
              安装
            </Button>
          </>
        }
      >
        <div className="mb-[18px] flex items-center gap-3 rounded-md border border-line bg-muted p-[13px]">
          <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-md border border-line bg-panel text-accent">
            <FolderInput size={21} />
          </div>
          <p className="m-0 text-[11px] leading-[1.55] text-ink-2">
            来源目录必须直接包含 <span className="font-mono">SKILL.md</span>。安装过程只复制文件，不执行 Skill
            中的脚本。
          </p>
        </div>
        <Field label="Skill 目录路径" className="mb-0">
          <Input
            autoFocus
            value={sourcePath}
            placeholder="C:\path\to\my-skill"
            onChange={(event) => setSourcePath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void installSkill();
            }}
          />
        </Field>
      </Dialog>
    </Page>
  );
}
