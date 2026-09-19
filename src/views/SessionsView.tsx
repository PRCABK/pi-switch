import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDownToLine, MoreHorizontal, Pencil, Play, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { DisplayEntry, SessionDetail, SessionSummary } from "../types";
import { errorText, formatShortTokens, formatTime } from "../lib/format";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Collapsible } from "../components/ui/collapsible";
import { Dropdown, DropdownItem, DropdownSeparator } from "../components/ui/dropdown";
import { confirmDialog, promptDialog, toast } from "../components/ui/feedback";
import { Input } from "../components/ui/input";
import { Page } from "../components/ui/page";
import { Panel, PanelHeader } from "../components/ui/panel";
import { LoadingOverlay } from "../components/ui/spinner";

/** 会话气泡：按角色切换底色与对齐，工具结果用等宽字体、历史分支降低透明度。 */
function messageClasses(entry: DisplayEntry): string {
  const role = entry.role || entry.entryType;
  return cn(
    "mb-3.5 max-w-[min(88%,760px)]",
    role === "user" && "ml-auto",
    !entry.active && "opacity-50",
  );
}

export default function SessionsView() {
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [keyword, setKeyword] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const detailRequestRef = useRef(0);

  const filteredSessions = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      [session.name, session.id, session.cwd, session.firstMessage, session.model, session.provider].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [keyword, sessions]);

  const displayEntries = useMemo(() => {
    if (!detail) return [];
    return activeOnly ? detail.entries.filter((entry) => entry.active) : detail.entries;
  }, [activeOnly, detail]);

  async function selectSession(session: SessionSummary) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedPath(session.path);
    setDetailLoading(true);
    try {
      const settings = loadSettings();
      const nextDetail = await api.getSessionDetail(session.path, settings.sessionsDir || undefined);
      if (detailRequestRef.current === requestId) setDetail(nextDetail);
    } catch (error) {
      if (detailRequestRef.current === requestId) toast.error(errorText(error));
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }

  async function loadSessions(keepSelection = true) {
    setLoading(true);
    try {
      const previous = keepSelection ? selectedPath : "";
      const result = await api.listSessions(loadSettings().sessionsDir || undefined);
      const list = result.sessions;
      setSessions(list);
      if (result.warnings.length) {
        toast.warning(`有 ${result.warnings.length} 个 Session 文件无法解析`);
      }
      if (previous && list.some((session) => session.path === previous)) {
        await selectSession(list.find((session) => session.path === previous)!);
      } else if (list.length) {
        await selectSession(list[0]);
      } else {
        setSelectedPath("");
        setDetail(null);
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions(false);
  }, []);

  async function continueSession() {
    if (!detail) return;
    try {
      const settings = loadSettings();
      await api.continueSession(detail.summary.id, detail.summary.cwd, settings.piPath || undefined);
      toast.success("已在外部终端打开 Pi");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function renameSession() {
    if (!detail) return;
    const name = await promptDialog({
      title: "重命名",
      message: "请输入新的会话名称",
      defaultValue: detail.summary.name || "",
      confirmText: "确定",
      validate: (value) => (value.trim() ? null : "名称不能为空"),
    });
    if (name === null) return;
    try {
      await api.renameSession(detail.summary.path, name, loadSettings().sessionsDir || undefined);
      await loadSessions(true);
      toast.success("会话名称已更新");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function deleteSession() {
    if (!detail) return;
    const confirmed = await confirmDialog({
      title: "删除会话",
      message: "将永久删除此 Session JSONL 文件，是否继续？",
      confirmText: "删除",
    });
    if (!confirmed) return;
    try {
      await api.deleteSession(detail.summary.path, loadSettings().sessionsDir || undefined);
      setSelectedPath("");
      await loadSessions(false);
      toast.success("会话已删除");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function exportSession() {
    if (!detail) return;
    try {
      const settings = loadSettings();
      const result = await api.exportSession(
        detail.summary.path,
        settings.piPath || undefined,
        settings.sessionsDir || undefined,
      );
      if (result.success) toast.success(`已导出到 ${result.output}`);
      else toast.error(result.output || "导出失败");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <Page
      title="对话管理"
      subtitle="浏览、管理并继续 Pi 历史 Session"
      actions={
        <Button icon={RefreshCw} loading={loading} onClick={() => void loadSessions(true)}>
          刷新
        </Button>
      }
    >
      <div className="grid min-h-[calc(100vh_-_169px)] grid-cols-[minmax(340px,36%)_minmax(0,1fr)] gap-4 max-[900px]:min-h-0 max-[900px]:grid-cols-1">
        <Panel>
          <PanelHeader>
            <div className="relative w-full">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
              <Input
                value={keyword}
                placeholder="搜索名称、ID、项目或模型"
                className="pl-8"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <span className="text-[12px] whitespace-nowrap text-ink-2">{filteredSessions.length} 个</span>
          </PanelHeader>
          <div className="relative">
            <LoadingOverlay visible={loading} />
            <div className="max-h-[calc(100vh_-_245px)] overflow-auto max-[900px]:max-h-[360px]">
              {filteredSessions.length ? (
                filteredSessions.map((session) => (
                  <article
                    key={session.path}
                    onClick={() => void selectSession(session)}
                    className={cn(
                      "relative cursor-pointer border-b border-line px-4 py-3.5 transition-colors last:border-b-0",
                      "hover:bg-hover active:bg-active",
                      selectedPath === session.path && "bg-accent-soft",
                    )}
                  >
                    {selectedPath === session.path ? (
                      <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-accent" />
                    ) : null}
                    <div className="flex items-baseline justify-between gap-2.5 text-caption">
                      <strong className="overflow-hidden text-control font-semibold text-ellipsis whitespace-nowrap text-ink">
                        {session.name || session.firstMessage || "未命名会话"}
                      </strong>
                      <span className="flex-none text-[10px] text-ink-3">{formatTime(session.modifiedAt)}</span>
                    </div>
                    <div className="my-[6px] h-8 overflow-hidden text-[11px] leading-4 text-ink-2">
                      {session.firstMessage || session.cwd}
                    </div>
                    <div className="flex justify-between gap-2.5 text-[10px] tabular-nums text-ink-3">
                      <span>
                        {session.provider && session.model ? `${session.provider}/${session.model}` : session.id}
                      </span>
                      <span>
                        {session.messageCount} 条 · {formatShortTokens(session.totalTokens)}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">没有找到 Session</div>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <LoadingOverlay visible={detailLoading} className="z-20" />
          {detail ? (
            <>
              <PanelHeader>
                <div className="min-w-0">
                  <h2 className="truncate">
                    {detail.summary.name || detail.summary.firstMessage || "未命名会话"}
                  </h2>
                  <div className="mt-[5px] font-mono text-[11px] text-ink-2 select-text">
                    pi --session {detail.summary.id}
                  </div>
                </div>
                <div className="toolbar">
                  <Button size="sm" variant="primary" icon={Play} onClick={() => void continueSession()}>
                    继续对话
                  </Button>
                  <Dropdown
                    trigger={
                      <Button size="sm" icon={MoreHorizontal} aria-label="更多操作" />
                    }
                  >
                    <DropdownItem icon={Pencil} onSelect={() => void renameSession()}>
                      重命名
                    </DropdownItem>
                    <DropdownItem icon={ArrowDownToLine} onSelect={() => void exportSession()}>
                      导出 HTML
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon={Trash2} danger onSelect={() => void deleteSession()}>
                      删除
                    </DropdownItem>
                  </Dropdown>
                </div>
              </PanelHeader>

              <div className="border-b border-line bg-muted px-4 py-3 text-[11px] text-ink-2">
                <div className="flex flex-wrap justify-between gap-3.5">
                  <span className="font-mono" title={detail.summary.cwd}>
                    {detail.summary.cwd}
                  </span>
                  <span>
                    {detail.summary.messageCount} 条消息 · {formatShortTokens(detail.summary.totalTokens)} tokens · $
                    {detail.summary.totalCost.toFixed(4)}
                  </span>
                </div>
                <Checkbox checked={activeOnly} onCheckedChange={setActiveOnly} className="mt-2">
                  仅显示当前活动分支
                </Checkbox>
              </div>

              <div className="h-[calc(100vh_-_241px)] overflow-auto bg-panel p-[22px] max-[900px]:h-auto max-[900px]:max-h-[600px] max-[600px]:p-3.5">
                {displayEntries.length ? (
                  displayEntries.map((entry) => {
                    const role = entry.role || entry.entryType;
                    const isUser = role === "user";
                    return (
                      <article key={entry.id} className={messageClasses(entry)}>
                        <div
                          className={cn(
                            "relative rounded-lg border border-line bg-panel px-[15px] py-3 shadow-sm",
                            isUser && "border-accent bg-accent text-inverse",
                            role === "assistant" && "rounded-bl-xs",
                            (role === "toolResult" || role === "bashExecution") && "bg-muted font-mono",
                            entry.isError && "border-[#ef9a9a] bg-[#fff5f5]",
                          )}
                        >
                          {isUser ? null : (
                            <div className="absolute top-3 -left-2.5 grid h-5 w-5 place-items-center rounded-sm border border-line bg-panel text-accent shadow-sm">
                              <Archive size={13} />
                            </div>
                          )}
                          <div
                            className={cn(
                              "mb-1.5 flex items-center justify-between gap-3 text-[10px]",
                              isUser ? "text-[rgba(255,255,255,0.84)]" : "text-ink-3",
                            )}
                          >
                            <strong className="font-semibold">
                              {entry.title}
                              {entry.toolName ? ` · ${entry.toolName}` : ""}
                            </strong>
                            <span>
                              {formatTime(entry.timestamp)}
                              {entry.active ? "" : " · 历史分支"}
                            </span>
                          </div>
                          {entry.text ? (
                            <p
                              className={cn(
                                "m-0 text-caption leading-[1.65] break-words whitespace-pre-wrap",
                                isUser ? "text-[rgba(255,255,255,0.84)]" : "text-ink",
                              )}
                            >
                              {entry.text}
                            </p>
                          ) : null}
                          {entry.thinking ? (
                            <Collapsible title="查看思考内容" className="mt-2">
                              <p className="m-0 text-caption leading-[1.65] break-words whitespace-pre-wrap text-ink-2">
                                {entry.thinking}
                              </p>
                            </Collapsible>
                          ) : null}
                          {entry.provider && entry.model ? (
                            <div className="mt-2 font-mono text-[10px] text-ink-2">
                              {entry.provider}/{entry.model}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">此 Session 没有可显示的记录</div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">选择一个 Session 查看对话</div>
          )}
        </Panel>
      </div>
    </Page>
  );
}
