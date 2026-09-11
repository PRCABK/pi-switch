import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Boxes, Download, PackagePlus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { InstalledPackage, PackageGalleryItem } from "../types";
import { errorText } from "../lib/format";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { confirmDialog, toast } from "../components/ui/feedback";
import { Field, Input } from "../components/ui/input";
import { Page } from "../components/ui/page";
import { Panel, PanelHeader } from "../components/ui/panel";
import { LoadingOverlay } from "../components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR, TableEmpty } from "../components/ui/table";
import { Tag } from "../components/ui/tag";

/** 安装命令中的高风险提示片段：等宽字体强调真实执行的命令。 */
function CommandText({ children }: { children: string }) {
  return <span className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</span>;
}

/**
 * 把来源规格缩到包身份，用于判断市场条目是否已安装。
 * npm：去掉 "npm:" 前缀后去掉末尾 "@version"；作用域包（@scope/pkg）的版本 @ 是最后一个 @。
 */
function baseName(source: string): string {
  if (source.startsWith("npm:")) {
    const rest = source.slice(4);
    const index = rest.lastIndexOf("@");
    return index > 0 ? rest.slice(0, index) : rest;
  }
  return source;
}

export default function PackagesView() {
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [installVisible, setInstallVisible] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [installSource, setInstallSource] = useState("");
  const [removeActionId, setRemoveActionId] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryItems, setGalleryItems] = useState<PackageGalleryItem[]>([]);
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryInstallingName, setGalleryInstallingName] = useState("");

  const sortedPackages = useMemo(
    () =>
      [...packages].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.source.localeCompare(b.source);
      }),
    [packages],
  );

  const npmCount = packages.filter((pkg) => pkg.kind === "npm").length;
  const gitCount = packages.filter((pkg) => pkg.kind === "git").length;
  const localCount = packages.filter((pkg) => pkg.kind === "local").length;

  const filteredGallery = useMemo(() => {
    const query = gallerySearch.trim().toLowerCase();
    if (!query) return galleryItems;
    return galleryItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.provider.toLowerCase().includes(query) ||
        item.types.toLowerCase().includes(query),
    );
  }, [galleryItems, gallerySearch]);

  const installedSources = useMemo(() => new Set(packages.map((pkg) => pkg.source)), [packages]);

  function isInstalled(item: PackageGalleryItem): boolean {
    const source = item.installCommand.replace(/^pi\s+install\s+/, "").trim();
    if (installedSources.has(source)) return true;
    const nameOnly = baseName(source);
    if (!nameOnly || nameOnly === source) return false;
    return [...installedSources].some((installed) => baseName(installed) === nameOnly);
  }

  async function loadPackages() {
    setLoading(true);
    try {
      setPackages(await api.listPackages(loadSettings().piPath || undefined));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPackages();
  }, []);

  async function doInstall(source: string): Promise<boolean> {
    setInstallLoading(true);
    try {
      const result = await api.installPackage(source, loadSettings().piPath || undefined);
      if (result.success) {
        toast.success(`安装完成：${source}`);
        await loadPackages();
        return true;
      }
      toast.error(`安装失败：${result.output || "未知错误"}`);
      return false;
    } catch (error) {
      toast.error(errorText(error));
      return false;
    } finally {
      setInstallLoading(false);
    }
  }

  async function installFromInput() {
    const source = installSource.trim();
    if (!source) {
      toast.warning("请输入插件来源，如 npm:pi-mcp-adapter");
      return;
    }
    const confirmed = await confirmDialog({
      title: "安装插件",
      message: (
        <>
          将执行 <CommandText>{`pi install ${source}`}</CommandText> 安装插件。插件拥有完整系统访问权限，请确认来源可信。
        </>
      ),
      confirmText: "安装",
    });
    if (!confirmed) return;
    const ok = await doInstall(source);
    if (ok) {
      setInstallVisible(false);
      setInstallSource("");
    }
  }

  async function installFromGallery(item: PackageGalleryItem) {
    const command = item.installCommand || `pi install npm:${item.name}`;
    const source = command.replace(/^pi\s+install\s+/, "").trim();
    if (!source) {
      toast.warning("无法解析安装命令");
      return;
    }
    const confirmed = await confirmDialog({
      title: `安装 ${item.name}`,
      message: (
        <>
          将执行 <CommandText>{command}</CommandText> 安装插件。插件拥有完整系统访问权限，请确认来源可信。
        </>
      ),
      confirmText: "安装",
    });
    if (!confirmed) return;
    setGalleryInstallingName(item.name);
    const ok = await doInstall(source);
    setGalleryInstallingName("");
    if (ok) toast.success(`已安装 ${item.name}`);
  }

  async function removePackage(pkg: InstalledPackage) {
    const confirmed = await confirmDialog({
      title: "卸载插件",
      message: (
        <>
          将执行 <CommandText>{`pi remove ${pkg.source}`}</CommandText> 卸载该插件，是否继续？
        </>
      ),
      confirmText: "卸载",
    });
    if (!confirmed) return;
    setRemoveActionId(pkg.source);
    try {
      const result = await api.removePackage(pkg.source, loadSettings().piPath || undefined);
      if (result.success) {
        toast.success(`已卸载 ${pkg.source}`);
        await loadPackages();
      } else {
        toast.error(`卸载失败：${result.output || "未知错误"}`);
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setRemoveActionId("");
    }
  }

  async function updateAllPackages() {
    const confirmed = await confirmDialog({
      title: "更新插件",
      message: (
        <>
          将执行 <CommandText>pi update --extensions</CommandText> 更新所有插件并同步 git 引用，可能需要较长时间。是否继续？
        </>
      ),
      confirmText: "更新",
    });
    if (!confirmed) return;
    setUpdateLoading(true);
    try {
      const result = await api.updatePackages(loadSettings().piPath || undefined);
      if (result.success) {
        toast.success("插件更新完成");
        await loadPackages();
      } else {
        toast.error(`更新失败：${result.output || "未知错误"}`);
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUpdateLoading(false);
    }
  }

  async function openGallery() {
    setGalleryVisible(true);
    setGallerySearch("");
    setGalleryItems([]);
    setGalleryLoading(true);
    try {
      const items = await api.searchPackages();
      setGalleryItems(items);
      if (!items.length) toast.info("pi.dev 暂无可用的插件");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setGalleryLoading(false);
    }
  }

  async function searchGallery() {
    setGalleryLoading(true);
    try {
      const items = await api.searchPackages(gallerySearch || undefined);
      setGalleryItems(items);
      if (!items.length) toast.info("没有找到匹配的插件");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setGalleryLoading(false);
    }
  }

  return (
    <Page
      title="插件管理"
      subtitle="管理 Pi 的已安装包，安装新插件，浏览 pi.dev 插件市场"
      loading={loading}
      actions={
        <>
          <Button icon={Boxes} onClick={() => void openGallery()}>
            浏览 pi.dev
          </Button>
          <Button icon={RefreshCw} onClick={() => void loadPackages()}>
            刷新
          </Button>
          <Button variant="primary" icon={PackagePlus} onClick={() => setInstallVisible(true)}>
            安装插件
          </Button>
        </>
      }
    >
      <Alert>
        已安装 <span className="font-mono">{packages.length}</span> 个插件
        <span className="ml-3.5">
          npm <strong>{npmCount}</strong>
        </span>
        <span className="ml-2.5">
          git <strong>{gitCount}</strong>
        </span>
        <span className="ml-2.5">
          local <strong>{localCount}</strong>
        </span>
      </Alert>

      <div className="mt-3.5 flex items-center gap-2.5">
        <Button size="sm" icon={Download} loading={updateLoading} onClick={() => void updateAllPackages()}>
          更新全部插件
        </Button>
        <span className="text-[12px] text-ink-2">运行 pi update --extensions 更新所有插件并同步 git 引用</span>
      </div>

      <Table className="mt-2">
        <THead>
          <TR className="hover:bg-transparent">
            <TH className="min-w-[280px]">来源</TH>
            <TH className="w-[100px]">类型</TH>
            <TH className="min-w-[200px]">范围 / 包名</TH>
            <TH className="w-[120px]" align="center">
              操作
            </TH>
          </TR>
        </THead>
        <TBody>
          {sortedPackages.length ? (
            sortedPackages.map((pkg) => (
              <TR key={pkg.source}>
                <TD>
                  <span className="font-mono">{pkg.source}</span>
                  {pkg.pinned ? (
                    <Tag className="ml-1.5" >
                      pinned
                    </Tag>
                  ) : null}
                </TD>
                <TD>
                  <Tag tone={pkg.kind === "git" ? "success" : "default"}>{pkg.kind}</Tag>
                </TD>
                <TD>
                  <span className="block max-w-[280px] truncate" title={pkg.scope}>
                    {pkg.scope}
                  </span>
                </TD>
                <TD align="center">
                  <Button
                    variant="linkDanger"
                    icon={Trash2}
                    loading={removeActionId === pkg.source}
                    onClick={() => void removePackage(pkg)}
                  >
                    卸载
                  </Button>
                </TD>
              </TR>
            ))
          ) : (
            <TableEmpty colSpan={4}>还没有安装插件</TableEmpty>
          )}
        </TBody>
      </Table>

      <Dialog
        open={installVisible}
        onOpenChange={setInstallVisible}
        title="安装插件"
        footer={
          <>
            <Button onClick={() => setInstallVisible(false)}>取消</Button>
            <Button variant="primary" icon={PackagePlus} loading={installLoading} onClick={() => void installFromInput()}>
              安装
            </Button>
          </>
        }
      >
        <div className="mb-[18px] flex items-center gap-3 rounded-md border border-line bg-muted p-[13px]">
          <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-md border border-line bg-panel text-accent">
            <PackagePlus size={21} />
          </div>
          <p className="m-0 text-[11px] leading-[1.55] text-ink-2">
            输入 <span className="font-mono">pi install</span> 的来源参数，支持 npm、git 和本地路径。插件拥有完整系统访问权限，请确认来源可信。
          </p>
        </div>
        <Field label="插件来源">
          <Input
            autoFocus
            value={installSource}
            placeholder="npm:pi-mcp-adapter"
            onChange={(event) => setInstallSource(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void installFromInput();
            }}
          />
        </Field>
        <div className="text-[12px] leading-[1.6] text-ink-2">
          npm：<span className="font-mono">npm:pi-mcp-adapter</span>、<span className="font-mono">npm:@scope/pkg@1.0.0</span>
          <br />
          git：<span className="font-mono">git:github.com/user/repo</span>、
          <span className="font-mono">https://github.com/user/repo</span>
          <br />
          本地：<span className="font-mono">/absolute/path/to/package</span>、
          <span className="font-mono">./relative/path</span>
        </div>
      </Dialog>

      <Dialog
        open={galleryVisible}
        onOpenChange={setGalleryVisible}
        title="浏览 pi.dev 插件市场"
        width={960}
        footer={<Button onClick={() => setGalleryVisible(false)}>关闭</Button>}
      >
        <div className="toolbar mb-3.5">
          <Input
            value={gallerySearch}
            placeholder="搜索插件名称、描述、作者或类型"
            className="w-[300px] max-[600px]:w-full"
            onChange={(event) => setGallerySearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchGallery();
            }}
          />
          <Button variant="primary" icon={Search} loading={galleryLoading} onClick={() => void searchGallery()}>
            搜索
          </Button>
          <span className="text-[12px] text-ink-2">
            {filteredGallery.length} / {galleryItems.length} 个
          </span>
        </div>

        <div className="relative grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 overflow-y-auto">
          <LoadingOverlay visible={galleryLoading} className="z-20" />
          {filteredGallery.map((item) => (
            <article
              key={item.name}
              className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-start justify-between">
                <div className="text-accent">
                  <Boxes size={18} strokeWidth={1.7} />
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {item.types
                    .split(" ")
                    .filter(Boolean)
                    .map((type) => (
                      <Tag key={type}>{type}</Tag>
                    ))}
                </div>
              </div>
              <div>
                <h2 className="m-0 text-body font-semibold text-ink">{item.name}</h2>
                <p className="mt-1 mb-0 line-clamp-2 overflow-hidden text-caption leading-[1.5] text-ink-2">
                  {item.description || "此插件没有提供描述。"}
                </p>
              </div>
              <div className="flex gap-2.5 text-micro text-ink-2">
                <span>{item.provider || "—"}</span>
                <span>{item.downloads}</span>
                <span>{item.updated}</span>
              </div>
              <div className="truncate rounded-sm bg-muted px-2 py-1.5 font-mono text-micro text-ink-2" title={item.installCommand}>
                {item.installCommand}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  icon={ArrowDownToLine}
                  loading={galleryInstallingName === item.name}
                  disabled={isInstalled(item)}
                  onClick={() => void installFromGallery(item)}
                >
                  {isInstalled(item) ? "已安装" : "安装"}
                </Button>
              </div>
            </article>
          ))}

          {!galleryLoading && !filteredGallery.length ? (
            <Panel className="col-span-full grid place-items-center p-10 text-center">
              <div className="empty-state flex flex-col items-center justify-center">
                <strong className="text-control text-ink">没有匹配的插件</strong>
                <span className="mt-1.5 block">尝试更换搜索关键词。</span>
              </div>
            </Panel>
          ) : null}
        </div>
      </Dialog>
    </Page>
  );
}
