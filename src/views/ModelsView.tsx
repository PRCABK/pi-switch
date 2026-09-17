import { useEffect, useState } from "react";
import { ArrowDownToLine, Pencil, Plus, RefreshCw, Save, Search, Trash2, Wrench } from "lucide-react";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { CatalogModel, ModelConfig, ProviderModel } from "../types";
import { errorText } from "../lib/format";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Descriptions } from "../components/ui/descriptions";
import { Dialog } from "../components/ui/dialog";
import { confirmDialog, promptDialog, toast } from "../components/ui/feedback";
import { Field, Input, PasswordInput, Select, Textarea } from "../components/ui/input";
import { Page } from "../components/ui/page";
import { Panel, PanelBody, PanelHeader } from "../components/ui/panel";
import { LoadingOverlay } from "../components/ui/spinner";
import { Switch } from "../components/ui/switch";
import { Table, TBody, TD, TH, THead, TR, TableEmpty } from "../components/ui/table";

const API_TYPES = ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"];

/** 自定义 Headers 的常用模板，值使用与 apiKey 相同的 $ENV_VAR 解析语法。 */
const HEADER_TEMPLATES: { id: string; label: string; headers: Record<string, string> }[] = [
  { id: "portkey", label: "Portkey 网关", headers: { "x-portkey-api-key": "$PORTKEY_API_KEY" } },
];

interface ModelForm {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
}

const EMPTY_MODEL_FORM: ModelForm = {
  id: "",
  name: "",
  reasoning: false,
  input: ["text"],
  contextWindow: 128000,
  maxTokens: 16384,
  costInput: 0,
  costOutput: 0,
  costCacheRead: 0,
  costCacheWrite: 0,
};

function toggleInSet(set: Set<string>, value: string, checked: boolean): Set<string> {
  const next = new Set(set);
  if (checked) next.add(value);
  else next.delete(value);
  return next;
}

/**
 * 合并 Provider 配置：保留已有 Provider 的字段，导入模型继承目标 Provider 的 API，
 * 模型按 id 去重覆盖。来源模型本身明确配置的 api 仍会保留。
 */
function mergeProvider(
  existing: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const sourceModels = Array.isArray(source.models) ? (source.models as Record<string, unknown>[]) : [];
  const existingModels = Array.isArray(existing.models) ? (existing.models as Record<string, unknown>[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  existingModels.forEach((model) => byId.set(String(model.id), model));
  sourceModels.forEach((model) => byId.set(String(model.id), model));
  return { ...source, ...existing, models: [...byId.values()] };
}

function displayApiKey(value: unknown): string {
  const key = String(value || "");
  if (!key) return "通过 Pi 登录或 CLI 提供";
  return key.startsWith("$") || key.startsWith("!") ? key : "已配置明文密钥（已隐藏）";
}

export default function ModelsView() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ModelConfig>({ providers: {} });
  const [configPath, setConfigPath] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorOriginalId, setEditorOriginalId] = useState("");
  const [editor, setEditor] = useState({
    id: "",
    baseUrl: "",
    apiKey: "",
    api: "openai-completions",
    authHeader: false,
    headers: "{}",
    models: "[]",
  });

  const [catalogVisible, setCatalogVisible] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState({ name: "", provider: "" });
  const [catalogResults, setCatalogResults] = useState<CatalogModel[]>([]);
  const [catalogChecked, setCatalogChecked] = useState<Set<string>>(new Set());
  const [catalogPreview, setCatalogPreview] = useState<ModelConfig | null>(null);
  const [catalogSelected, setCatalogSelected] = useState<CatalogModel | null>(null);
  const [catalogBatchLoading, setCatalogBatchLoading] = useState(false);
  const [importForm, setImportForm] = useState({
    targetProvider: "",
    baseUrl: "",
    apiKey: "$CUSTOM_PROVIDER_API_KEY",
  });

  const [validationVisible, setValidationVisible] = useState(false);
  const [validationOutput, setValidationOutput] = useState("");

  const [providerModelsVisible, setProviderModelsVisible] = useState(false);
  const [providerModelsLoading, setProviderModelsLoading] = useState(false);
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);
  const [providerModelsStep, setProviderModelsStep] = useState<1 | 2>(1);
  const [providerModelsChecked, setProviderModelsChecked] = useState<Set<string>>(new Set());
  const [v1SearchLoading, setV1SearchLoading] = useState(false);
  const [v1GroupedResults, setV1GroupedResults] = useState<{ provider: string; models: CatalogModel[] }[]>([]);
  const [v1CheckedPaths, setV1CheckedPaths] = useState<Set<string>>(new Set());
  const [providerModelsFromEditor, setProviderModelsFromEditor] = useState(false);

  const [modelDialogVisible, setModelDialogVisible] = useState(false);
  const [editingModelIndex, setEditingModelIndex] = useState(-1);
  const [modelForm, setModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM);

  const providers = Object.entries(config.providers || {}).map(([id, value]) => ({ id, value }));
  const selected = config.providers[selectedProvider];
  const selectedModels = Array.isArray(selected?.models)
    ? (selected.models as Record<string, unknown>[])
    : [];

  async function loadConfig() {
    setLoading(true);
    try {
      const result = await api.readModelConfig(loadSettings().modelsPath || undefined);
      const next = result.config;
      next.providers ||= {};
      setConfig(next);
      setConfigPath(result.path);
      if (!selectedProvider || !next.providers[selectedProvider]) {
        setSelectedProvider(Object.keys(next.providers)[0] || "");
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  function openEditor(id?: string) {
    const value = id ? config.providers[id] || {} : {};
    setEditorOriginalId(id || "");
    setEditor({
      id: id || "",
      baseUrl: String(value.baseUrl || ""),
      apiKey: String(value.apiKey || ""),
      api: String(value.api || "openai-completions"),
      authHeader: Boolean(value.authHeader),
      headers: JSON.stringify(value.headers || {}, null, 2),
      models: JSON.stringify(value.models || [], null, 2),
    });
    setEditorVisible(true);
  }

  function applyEditor() {
    const id = editor.id.trim();
    if (!id) {
      toast.warning("请输入 Provider ID");
      return;
    }
    if (id !== editorOriginalId && config.providers[id]) {
      toast.warning("Provider ID 已存在");
      return;
    }
    try {
      const headers = JSON.parse(editor.headers || "{}");
      const models = JSON.parse(editor.models || "[]");
      if (!Array.isArray(models)) throw new Error("模型配置必须是数组");
      const previous = editorOriginalId ? config.providers[editorOriginalId] || {} : {};
      const next: Record<string, unknown> = { ...previous, api: editor.api, models };
      if (editor.baseUrl.trim()) next.baseUrl = editor.baseUrl.trim();
      else delete next.baseUrl;
      if (editor.apiKey.trim()) next.apiKey = editor.apiKey.trim();
      else delete next.apiKey;
      if (editor.authHeader) next.authHeader = true;
      else delete next.authHeader;
      if (Object.keys(headers).length) next.headers = headers;
      else delete next.headers;

      setConfig((prev) => {
        const providersNext = { ...prev.providers };
        if (editorOriginalId && editorOriginalId !== id) delete providersNext[editorOriginalId];
        providersNext[id] = next;
        return { ...prev, providers: providersNext };
      });
      setSelectedProvider(id);
      setEditorVisible(false);
    } catch (error) {
      toast.error(`JSON 配置有误：${errorText(error)}`);
    }
  }

  /**
   * 把模板 Header 合并进编辑器内容：解析失败时不写回，避免覆盖用户正在编辑的文本；
   * 同名键保留用户已设置的值。
   */
  function applyHeaderTemplate(headers: Record<string, string>) {
    let current: Record<string, unknown>;
    try {
      const parsed = JSON.parse(editor.headers || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("不是 JSON 对象");
      current = parsed as Record<string, unknown>;
    } catch {
      toast.warning("当前自定义 Headers 不是合法的 JSON 对象，请先修正后再插入模板");
      return;
    }
    const kept = Object.keys(headers).filter((key) => key in current);
    setEditor((prev) => ({ ...prev, headers: JSON.stringify({ ...headers, ...current }, null, 2) }));
    if (kept.length) toast.info(`已插入模板，保留了你已设置的键：${kept.join("、")}`);
  }

  async function removeProvider(id: string) {
    const confirmed = await confirmDialog({
      title: "删除确认",
      message: `确定删除 Provider “${id}”吗？保存配置后才会写入磁盘。`,
      confirmText: "删除",
    });
    if (!confirmed) return;
    const providersNext = { ...config.providers };
    delete providersNext[id];
    setConfig({ ...config, providers: providersNext });
    setSelectedProvider(Object.keys(providersNext)[0] || "");
  }

  function updateProviderModels(models: Record<string, unknown>[]) {
    setConfig((prev) => {
      const provider = prev.providers[selectedProvider];
      if (!provider) return prev;
      return {
        ...prev,
        providers: { ...prev.providers, [selectedProvider]: { ...provider, models } },
      };
    });
  }

  function openModelEditor(index?: number) {
    const model = index !== undefined && index >= 0 ? selectedModels[index] : null;
    const cost = (model?.cost as Record<string, unknown> | undefined) ?? {};
    setModelForm({
      id: String(model?.id ?? ""),
      name: String(model?.name ?? ""),
      reasoning: Boolean(model?.reasoning),
      input: Array.isArray(model?.input) ? [...(model.input as string[])] : ["text"],
      contextWindow: Number(model?.contextWindow ?? 128000),
      maxTokens: Number(model?.maxTokens ?? 16384),
      costInput: Number(cost.input ?? 0),
      costOutput: Number(cost.output ?? 0),
      costCacheRead: Number(cost.cacheRead ?? 0),
      costCacheWrite: Number(cost.cacheWrite ?? 0),
    });
    setEditingModelIndex(index ?? -1);
    setModelDialogVisible(true);
  }

  function applyModel() {
    const id = modelForm.id.trim();
    if (!id) {
      toast.warning("请输入模型 ID");
      return;
    }
    const duplicate = selectedModels.some((model, index) => String(model.id) === id && index !== editingModelIndex);
    if (duplicate) {
      toast.warning("模型 ID 已存在");
      return;
    }
    const model: Record<string, unknown> = {
      id,
      reasoning: modelForm.reasoning,
      input: modelForm.input.length ? [...modelForm.input] : ["text"],
      contextWindow: modelForm.contextWindow,
      maxTokens: modelForm.maxTokens,
      cost: {
        input: modelForm.costInput,
        output: modelForm.costOutput,
        cacheRead: modelForm.costCacheRead,
        cacheWrite: modelForm.costCacheWrite,
      },
    };
    if (modelForm.name.trim()) model.name = modelForm.name.trim();
    const models = [...selectedModels];
    if (editingModelIndex >= 0) {
      const original = models[editingModelIndex] ?? {};
      models[editingModelIndex] = { ...original, ...model };
    } else {
      models.push(model);
    }
    updateProviderModels(models);
    setModelDialogVisible(false);
    toast.success("模型已更新，点击“保存配置”写入磁盘");
  }

  async function removeModel(index: number) {
    const confirmed = await confirmDialog({
      title: "删除确认",
      message: "确定删除该模型吗？保存配置后才会写入磁盘。",
      confirmText: "删除",
    });
    if (!confirmed) return;
    const models = [...selectedModels];
    models.splice(index, 1);
    updateProviderModels(models);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const backup = await api.saveModelConfig(config, configPath);
      toast.success(backup ? `保存成功，已备份到 ${backup}` : "保存成功");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  /** 拉取 {baseUrl}/models 并打开向导，两个入口共用这里的状态重置与错误处理。 */
  async function loadProviderModels(baseUrl: string, apiKey: string, fromEditor: boolean) {
    setProviderModelsFromEditor(fromEditor);
    setProviderModelsVisible(true);
    setProviderModels([]);
    setProviderModelsStep(1);
    setProviderModelsChecked(new Set());
    setV1GroupedResults([]);
    setV1CheckedPaths(new Set());
    setProviderModelsLoading(true);
    try {
      const result = await api.fetchProviderModels(baseUrl, apiKey);
      setProviderModels(result);
      if (!result.length) toast.info("/v1/models 返回的列表为空");
    } catch (error) {
      toast.error(errorText(error));
      setProviderModelsVisible(false);
    } finally {
      setProviderModelsLoading(false);
    }
  }

  async function openProviderModels() {
    if (!selected) {
      toast.warning("请先选择一个 Provider");
      return;
    }
    const baseUrl = String(selected.baseUrl || "");
    if (!baseUrl) {
      toast.warning("当前 Provider 未配置 Base URL");
      return;
    }
    await loadProviderModels(baseUrl, String(selected.apiKey || ""), false);
  }

  /** 新增或编辑 Provider 时用对话框里刚填的 Base URL 与 API Key 拉取，导入结果写回编辑器的模型配置字段。 */
  async function openEditorProviderModels() {
    const baseUrl = editor.baseUrl.trim();
    if (!baseUrl) {
      toast.warning("请先填写 Base URL");
      return;
    }
    await loadProviderModels(baseUrl, editor.apiKey, true);
  }

  async function v1SearchSelected() {
    if (!providerModelsChecked.size) {
      toast.warning("请先勾选要查询的模型 ID");
      return;
    }
    // 先让用户限定 Provider，避免一次性加载过多 Provider 导致卡顿
    const providerFilter = await promptDialog({
      title: "搜索 pi.dev",
      message:
        "限定 Provider 可以只搜索指定厂商的模型（如 openai、anthropic、opencode 等），避免一次性加载太多结果导致卡顿。留空则搜索全部。",
      placeholder: "Provider，如 openai",
      confirmText: "搜索",
    });
    if (providerFilter === null) return;

    setV1SearchLoading(true);
    setV1GroupedResults([]);
    setV1CheckedPaths(new Set());
    try {
      const grouped = new Map<string, CatalogModel[]>();
      for (const id of providerModelsChecked) {
        try {
          const hits = await api.searchCatalog(id, providerFilter.trim() || undefined);
          for (const hit of hits) {
            if (!grouped.has(hit.provider)) grouped.set(hit.provider, []);
            grouped.get(hit.provider)!.push(hit);
          }
        } catch (error) {
          console.error(`搜索 ${id} 失败`, error);
        }
      }
      const groups = [...grouped.entries()].map(([provider, models]) => ({ provider, models }));
      setV1GroupedResults(groups);
      if (groups.length) setProviderModelsStep(2);
      else toast.info("未在 pi.dev 匹配到任何模型");
    } finally {
      setV1SearchLoading(false);
    }
  }

  async function v1BatchImport() {
    if (!v1CheckedPaths.size) {
      toast.warning("请勾选要导入的模型");
      return;
    }
    if (!providerModelsFromEditor && !selectedProvider) {
      toast.warning("请先选择目标 Provider");
      return;
    }
    let editorModels: Record<string, unknown>[] = [];
    if (providerModelsFromEditor) {
      try {
        const parsed = JSON.parse(editor.models || "[]");
        if (!Array.isArray(parsed)) throw new Error("不是 JSON 数组");
        editorModels = parsed as Record<string, unknown>[];
      } catch {
        toast.warning("模型配置不是合法的 JSON 数组，请先修正后再导入");
        return;
      }
    }
    const target = selectedProvider;
    setProviderModelsLoading(true);
    let draft: Record<string, unknown> = providerModelsFromEditor
      ? { models: editorModels }
      : config.providers[target] || {};
    let imported = 0;
    let failed = 0;
    try {
      for (const detailPath of v1CheckedPaths) {
        try {
          const preview = await api.fetchCatalogConfig(detailPath);
          const sourceId = Object.keys(preview.providers)[0];
          draft = mergeProvider(draft, preview.providers[sourceId] || {});
          imported += 1;
        } catch (error) {
          failed += 1;
          console.error(`导入 ${detailPath} 失败`, error);
        }
      }
      if (imported) {
        if (providerModelsFromEditor) {
          setEditor((prev) => ({ ...prev, models: JSON.stringify(draft.models ?? [], null, 2) }));
        } else {
          setConfig((prev) => ({ ...prev, providers: { ...prev.providers, [target]: draft } }));
        }
        const hint = providerModelsFromEditor ? "点「应用」后再保存配置" : "请确认后保存";
        toast.success(`已导入 ${imported} 个模型${failed ? `，${failed} 个失败` : ""}，${hint}`);
        setProviderModelsVisible(false);
      } else {
        toast.error("全部导入失败");
      }
    } finally {
      setProviderModelsLoading(false);
    }
  }

  async function validateConfig() {
    try {
      const result = await api.validateModels(loadSettings().piPath || undefined);
      setValidationOutput(result.output || (result.success ? "验证通过" : "验证失败"));
      setValidationVisible(true);
      if (!result.success) toast.warning("pi --list-models 执行失败");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function searchCatalog() {
    if (!catalogQuery.name.trim()) {
      toast.warning("请输入模型名称");
      return;
    }
    setCatalogLoading(true);
    setCatalogPreview(null);
    try {
      const results = await api.searchCatalog(catalogQuery.name, catalogQuery.provider || undefined);
      setCatalogResults(results);
      setCatalogChecked(new Set());
      if (!results.length) toast.info("没有找到匹配模型");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCatalogLoading(false);
    }
  }

  async function selectCatalogModel(model: CatalogModel) {
    setCatalogLoading(true);
    try {
      const preview = await api.fetchCatalogConfig(model.detailPath);
      setCatalogSelected(model);
      setCatalogPreview(preview);
      const sourceId = Object.keys(preview.providers)[0] || model.provider;
      const source = preview.providers[sourceId] || {};
      const target = selectedProvider || sourceId;
      setImportForm({
        targetProvider: target,
        baseUrl: String(config.providers[target]?.baseUrl || source.baseUrl || ""),
        apiKey: String(config.providers[target]?.apiKey || "$CUSTOM_PROVIDER_API_KEY"),
      });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCatalogLoading(false);
    }
  }

  function importCatalogConfig() {
    const preview = catalogPreview;
    const target = importForm.targetProvider.trim();
    if (!preview || !target) {
      toast.warning("请输入目标 Provider ID");
      return;
    }
    const sourceId = Object.keys(preview.providers)[0];
    const source = preview.providers[sourceId] || {};
    const merged = mergeProvider(config.providers[target] || {}, source);
    if (importForm.baseUrl.trim()) merged.baseUrl = importForm.baseUrl.trim();
    if (importForm.apiKey.trim()) merged.apiKey = importForm.apiKey.trim();
    setConfig((prev) => ({ ...prev, providers: { ...prev.providers, [target]: merged } }));
    setSelectedProvider(target);
    setCatalogVisible(false);
    toast.success(`已导入 ${catalogSelected?.name || "模型"}，请确认后保存`);
  }

  async function batchImportCatalog() {
    if (!catalogChecked.size) {
      toast.warning("请先勾选要导入的模型");
      return;
    }
    if (!selectedProvider) {
      toast.warning("请先选择目标 Provider");
      return;
    }
    const target = selectedProvider;
    const rows = catalogResults.filter((row) => catalogChecked.has(row.detailPath));
    setCatalogBatchLoading(true);
    let draft = config.providers[target] || {};
    let imported = 0;
    let failed = 0;
    try {
      for (const row of rows) {
        try {
          const preview = await api.fetchCatalogConfig(row.detailPath);
          const sourceId = Object.keys(preview.providers)[0];
          draft = mergeProvider(draft, preview.providers[sourceId] || {});
          imported += 1;
        } catch (error) {
          failed += 1;
          console.error(`导入 ${row.name} 失败`, error);
        }
      }
      if (imported) {
        setConfig((prev) => ({ ...prev, providers: { ...prev.providers, [target]: draft } }));
        toast.success(`已导入 ${imported} 个模型${failed ? `，${failed} 个失败` : ""}，请确认后保存`);
        setCatalogVisible(false);
      } else {
        toast.error("全部导入失败");
      }
    } finally {
      setCatalogBatchLoading(false);
    }
  }

  const allCatalogChecked =
    catalogResults.length > 0 && catalogResults.every((row) => catalogChecked.has(row.detailPath));
  const allProviderModelsChecked =
    providerModels.length > 0 && providerModels.every((model) => providerModelsChecked.has(model.id));

  return (
    <Page
      title="模型管理"
      subtitle="管理 Pi 的自定义 Provider 和模型配置"
      loading={loading}
      actions={
        <>
          <Button icon={Search} onClick={() => setCatalogVisible(true)}>
            从 pi.dev 导入
          </Button>
          <Button icon={RefreshCw} onClick={() => void loadConfig()}>
            重新加载
          </Button>
          <Button variant="primary" icon={Save} loading={saving} onClick={() => void saveConfig()}>
            保存配置
          </Button>
        </>
      }
    >
      <Alert>
        配置文件：<span className="font-mono">{configPath}</span>
      </Alert>

      <div className="mt-[18px] flex flex-wrap items-center gap-2">
        {providers.length ? (
          providers.map((provider) => (
            <Button
              key={provider.id}
              size="sm"
              variant={selectedProvider === provider.id ? "primary" : "default"}
              onClick={() => setSelectedProvider(provider.id)}
            >
              {provider.id}
            </Button>
          ))
        ) : (
          <span className="text-caption text-ink-3">还没有自定义 Provider</span>
        )}
        <Button size="sm" icon={Plus} onClick={() => openEditor()}>
          新增
        </Button>
      </div>

      <Panel className="mt-4">
          {selected ? (
            <>
              <PanelHeader>
                <h2 className="flex-col items-start gap-0.5">
                  <span className="section-kicker">ACTIVE PROVIDER</span>
                  {selectedProvider}
                </h2>
                <div className="toolbar">
                  <Button size="sm" icon={RefreshCw} onClick={() => void openProviderModels()}>
                    从 /v1/models 获取
                  </Button>
                  <Button size="sm" icon={Pencil} onClick={() => openEditor(selectedProvider)}>
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerPlain"
                    icon={Trash2}
                    onClick={() => void removeProvider(selectedProvider)}
                  >
                    删除
                  </Button>
                </div>
              </PanelHeader>
              <PanelBody>
                <Descriptions
                  column={2}
                  items={[
                    { label: "Base URL", children: String(selected.baseUrl || "使用内置地址") },
                    { label: "API", children: String(selected.api || "继承内置配置") },
                    { label: "API Key", children: displayApiKey(selected.apiKey) },
                    { label: "模型数量", children: selectedModels.length },
                  ]}
                />

                <div className="subsection-head">
                  <h3>
                    <span className="section-kicker">CATALOG</span>模型列表
                  </h3>
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => openModelEditor()}>
                    新增模型
                  </Button>
                </div>

                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH className="min-w-[170px]">模型 ID</TH>
                      <TH className="min-w-[130px]">名称</TH>
                      <TH className="w-[110px]">上下文</TH>
                      <TH className="w-[110px]">最大输出</TH>
                      <TH className="w-[72px]">推理</TH>
                      <TH className="w-[130px]">操作</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {selectedModels.length ? (
                      selectedModels.map((model, index) => (
                        <TR key={`${String(model.id)}-${index}`}>
                          <TD>{String(model.id ?? "")}</TD>
                          <TD>{String(model.name ?? "")}</TD>
                          <TD>{String(model.contextWindow ?? "")}</TD>
                          <TD>{String(model.maxTokens ?? "")}</TD>
                          <TD>{model.reasoning ? "是" : "否"}</TD>
                          <TD>
                            <Button variant="link" icon={Pencil} onClick={() => openModelEditor(index)}>
                              编辑
                            </Button>
                            <Button variant="linkDanger" icon={Trash2} onClick={() => void removeModel(index)}>
                              删除
                            </Button>
                          </TD>
                        </TR>
                      ))
                    ) : (
                      <TableEmpty colSpan={6}>没有配置自定义模型</TableEmpty>
                    )}
                  </TBody>
                </Table>

                <div className="mt-4 flex items-center gap-3">
                  <Button icon={Wrench} onClick={() => void validateConfig()}>
                    运行 pi --list-models
                  </Button>
                  <span className="text-[10px] text-ink-3">写入前建议先校验当前配置</span>
                </div>
              </PanelBody>
            </>
          ) : (
            <div className="empty-state">选择或新增一个 Provider</div>
          )}
      </Panel>

      <Dialog
        open={editorVisible}
        onOpenChange={setEditorVisible}
        title={editorOriginalId ? "编辑 Provider" : "新增 Provider"}
        width={720}
        footer={
          <>
            <Button onClick={() => setEditorVisible(false)}>取消</Button>
            <Button variant="primary" onClick={applyEditor}>
              应用
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <Field label="Provider ID">
            <Input
              value={editor.id}
              placeholder="custom-provider"
              onChange={(event) => setEditor((prev) => ({ ...prev, id: event.target.value }))}
            />
          </Field>
          <Field label="API 类型">
            <Select
              value={editor.api}
              onChange={(event) => setEditor((prev) => ({ ...prev, api: event.target.value }))}
            >
              {API_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Base URL">
          <Input
            value={editor.baseUrl}
            placeholder="https://api.example.com/v1"
            onChange={(event) => setEditor((prev) => ({ ...prev, baseUrl: event.target.value }))}
          />
        </Field>
        <Field label="API Key" hint="建议使用环境变量引用，不要保存明文 Key。">
          <PasswordInput
            value={editor.apiKey}
            placeholder="$CUSTOM_PROVIDER_API_KEY"
            onChange={(event) => setEditor((prev) => ({ ...prev, apiKey: event.target.value }))}
          />
        </Field>
        <Field className="mb-[18px]">
          <Checkbox
            checked={editor.authHeader}
            onCheckedChange={(checked) => setEditor((prev) => ({ ...prev, authHeader: checked }))}
          >
            自动添加 Authorization: Bearer 请求头
          </Checkbox>
        </Field>
        <Field label="自定义 Headers（JSON 对象）">
          <div className="toolbar mb-2">
            <Select
              value=""
              className="w-[190px]"
              onChange={(event) => {
                const template = HEADER_TEMPLATES.find((item) => item.id === event.target.value);
                if (template) applyHeaderTemplate(template.headers);
              }}
            >
              <option value="">插入常用模板…</option>
              {HEADER_TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            rows={4}
            className="font-mono"
            value={editor.headers}
            onChange={(event) => setEditor((prev) => ({ ...prev, headers: event.target.value }))}
          />
        </Field>
        <Field label="模型配置（JSON 数组）" className="mb-0">
          <div className="toolbar mb-2">
            <Button size="sm" icon={RefreshCw} onClick={() => void openEditorProviderModels()}>
              从 /v1/models 获取
            </Button>
            <span className="text-[10px] text-ink-3">用上方填写的 Base URL 与 API Key 拉取，结果导入本字段</span>
          </div>
          <Textarea
            rows={12}
            className="font-mono"
            value={editor.models}
            onChange={(event) => setEditor((prev) => ({ ...prev, models: event.target.value }))}
          />
        </Field>
      </Dialog>

      <Dialog
        open={modelDialogVisible}
        onOpenChange={setModelDialogVisible}
        title={editingModelIndex >= 0 ? "编辑模型" : "新增模型"}
        width={640}
        footer={
          <>
            <Button onClick={() => setModelDialogVisible(false)}>取消</Button>
            <Button variant="primary" onClick={applyModel}>
              应用
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <Field label="模型 ID">
            <Input
              value={modelForm.id}
              placeholder="gpt-5.5"
              onChange={(event) => setModelForm((prev) => ({ ...prev, id: event.target.value }))}
            />
          </Field>
          <Field label="显示名称">
            <Input
              value={modelForm.name}
              placeholder="GPT-5.5"
              onChange={(event) => setModelForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <Field label="支持推理">
            <Switch
              checked={modelForm.reasoning}
              onCheckedChange={(checked) => setModelForm((prev) => ({ ...prev, reasoning: checked }))}
            />
          </Field>
          <Field label="输入类型">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={modelForm.input.includes("text")}
                onCheckedChange={(checked) =>
                  setModelForm((prev) => ({
                    ...prev,
                    input: checked
                      ? [...new Set([...prev.input, "text"])]
                      : prev.input.filter((item) => item !== "text"),
                  }))
                }
              >
                文本
              </Checkbox>
              <Checkbox
                checked={modelForm.input.includes("image")}
                onCheckedChange={(checked) =>
                  setModelForm((prev) => ({
                    ...prev,
                    input: checked
                      ? [...new Set([...prev.input, "image"])]
                      : prev.input.filter((item) => item !== "image"),
                  }))
                }
              >
                图片
              </Checkbox>
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <Field label="上下文窗口">
            <Input
              type="number"
              min={1}
              step={1000}
              value={modelForm.contextWindow}
              onChange={(event) => setModelForm((prev) => ({ ...prev, contextWindow: Number(event.target.value) }))}
            />
          </Field>
          <Field label="最大输出 Tokens">
            <Input
              type="number"
              min={1}
              step={1000}
              value={modelForm.maxTokens}
              onChange={(event) => setModelForm((prev) => ({ ...prev, maxTokens: Number(event.target.value) }))}
            />
          </Field>
        </div>
        <Field label="价格（美元 / 百万 tokens）" className="mb-0">
          <div className="toolbar">
            <Input
              type="number"
              min={0}
              step={0.5}
              className="w-[130px]"
              value={modelForm.costInput}
              onChange={(event) => setModelForm((prev) => ({ ...prev, costInput: Number(event.target.value) }))}
            />
            <span className="text-[12px] text-ink-2">输入</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              className="w-[130px]"
              value={modelForm.costOutput}
              onChange={(event) => setModelForm((prev) => ({ ...prev, costOutput: Number(event.target.value) }))}
            />
            <span className="text-[12px] text-ink-2">输出</span>
          </div>
          <div className="toolbar mt-2.5">
            <Input
              type="number"
              min={0}
              step={0.5}
              className="w-[130px]"
              value={modelForm.costCacheRead}
              onChange={(event) => setModelForm((prev) => ({ ...prev, costCacheRead: Number(event.target.value) }))}
            />
            <span className="text-[12px] text-ink-2">缓存读取</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              className="w-[130px]"
              value={modelForm.costCacheWrite}
              onChange={(event) => setModelForm((prev) => ({ ...prev, costCacheWrite: Number(event.target.value) }))}
            />
            <span className="text-[12px] text-ink-2">缓存写入</span>
          </div>
        </Field>
      </Dialog>

      <Dialog
        open={catalogVisible}
        onOpenChange={setCatalogVisible}
        title="从 pi.dev 模型目录导入"
        width={920}
        footer={
          <>
            <Button onClick={() => setCatalogVisible(false)}>取消</Button>
            {catalogPreview ? (
              <Button variant="primary" onClick={importCatalogConfig}>
                导入配置
              </Button>
            ) : null}
          </>
        }
      >
        <div className="toolbar mb-3.5">
          <Input
            value={catalogQuery.name}
            className="w-[280px] max-[600px]:w-full"
            placeholder="模型名称，如 gpt-5.5"
            onChange={(event) => setCatalogQuery((prev) => ({ ...prev, name: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchCatalog();
            }}
          />
          <Input
            value={catalogQuery.provider}
            className="w-[210px] max-[600px]:w-full"
            placeholder="Provider，如 openai"
            onChange={(event) => setCatalogQuery((prev) => ({ ...prev, provider: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchCatalog();
            }}
          />
          <Button variant="primary" icon={Search} loading={catalogLoading} onClick={() => void searchCatalog()}>
            搜索
          </Button>
          {catalogChecked.size ? (
            <span className="text-[12px] text-ink-2">已选 {catalogChecked.size} 个</span>
          ) : null}
        </div>

        <div className="relative">
          <LoadingOverlay visible={catalogLoading} className="z-20" />
          {catalogPreview ? (
            <>
              <Button variant="link" onClick={() => setCatalogPreview(null)}>
                ← 返回搜索结果
              </Button>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 max-[900px]:grid-cols-1">
                <div>
                  <Field label="目标 Provider ID">
                    <Input
                      value={importForm.targetProvider}
                      onChange={(event) => setImportForm((prev) => ({ ...prev, targetProvider: event.target.value }))}
                    />
                  </Field>
                  <Field label="Base URL">
                    <Input
                      value={importForm.baseUrl}
                      onChange={(event) => setImportForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    />
                  </Field>
                  <Field label="API Key" className="mb-0">
                    <PasswordInput
                      value={importForm.apiKey}
                      onChange={(event) => setImportForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                    />
                  </Field>
                </div>
                <pre className="json-preview">{JSON.stringify(catalogPreview, null, 2)}</pre>
              </div>
            </>
          ) : (
            <>
              {catalogChecked.size ? (
                <div className="mb-2.5 flex justify-end">
                  <Button
                    variant="primary"
                    icon={ArrowDownToLine}
                    loading={catalogBatchLoading}
                    onClick={() => void batchImportCatalog()}
                  >
                    批量导入选中
                  </Button>
                </div>
              ) : null}
              <div className="max-h-[420px] overflow-auto">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-[46px]">
                      <Checkbox
                        checked={allCatalogChecked}
                        onCheckedChange={(checked) =>
                          setCatalogChecked(
                            checked ? new Set(catalogResults.map((row) => row.detailPath)) : new Set(),
                          )
                        }
                      />
                    </TH>
                    <TH className="min-w-[180px]">模型</TH>
                    <TH className="min-w-[220px]">模型 ID</TH>
                    <TH className="w-[160px]">Provider</TH>
                    <TH className="w-[110px]">上下文</TH>
                    <TH className="w-[100px]">操作</TH>
                  </TR>
                </THead>
                <TBody>
                  {catalogResults.length ? (
                    catalogResults.map((row) => (
                      <TR key={row.detailPath}>
                        <TD>
                          <Checkbox
                            checked={catalogChecked.has(row.detailPath)}
                            onCheckedChange={(checked) =>
                              setCatalogChecked((prev) => toggleInSet(prev, row.detailPath, checked))
                            }
                          />
                        </TD>
                        <TD>{row.name}</TD>
                        <TD>{row.id}</TD>
                        <TD>{row.provider}</TD>
                        <TD>{row.contextWindow}</TD>
                        <TD>
                          <Button variant="link" icon={ArrowDownToLine} onClick={() => void selectCatalogModel(row)}>
                            获取配置
                          </Button>
                        </TD>
                      </TR>
                    ))
                  ) : (
                    <TableEmpty colSpan={6}>输入名称后搜索</TableEmpty>
                  )}
                </TBody>
              </Table>
              </div>
            </>
          )}
        </div>
      </Dialog>

      <Dialog
        open={providerModelsVisible}
        onOpenChange={setProviderModelsVisible}
        title="从 Provider /v1/models 获取模型"
        width={960}
        footer={<Button onClick={() => setProviderModelsVisible(false)}>取消</Button>}
      >
        <div className="relative">
          <LoadingOverlay visible={providerModelsLoading} className="z-20" />
          {providerModelsStep === 1 ? (
            <>
              <p className="mb-2.5 text-caption text-ink-2">
                已从{" "}
                <span className="font-mono">
                  {providerModelsFromEditor ? editor.baseUrl.trim() : String(selected?.baseUrl)}/models
                </span>{" "}
                拉到 {providerModels.length} 个模型 ID。勾选后用这些 ID 去 pi.dev 精准搜索，再按 Provider 分组选择导入。
              </p>
              <div className="mb-2.5 flex items-center justify-end gap-2">
                <span className="text-[12px] text-ink-2">
                  已选 {providerModelsChecked.size} / {providerModels.length}
                </span>
                <Button
                  variant="primary"
                  icon={Search}
                  loading={v1SearchLoading}
                  disabled={!providerModelsChecked.size}
                  onClick={() => void v1SearchSelected()}
                >
                  搜索 pi.dev
                </Button>
              </div>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-[46px]">
                      <Checkbox
                        checked={allProviderModelsChecked}
                        onCheckedChange={(checked) =>
                          setProviderModelsChecked(
                            checked ? new Set(providerModels.map((model) => model.id)) : new Set(),
                          )
                        }
                      />
                    </TH>
                    <TH>模型 ID</TH>
                  </TR>
                </THead>
                <TBody>
                  {providerModels.length ? (
                    providerModels.map((model) => (
                      <TR key={model.id}>
                        <TD>
                          <Checkbox
                            checked={providerModelsChecked.has(model.id)}
                            onCheckedChange={(checked) =>
                              setProviderModelsChecked((prev) => toggleInSet(prev, model.id, checked))
                            }
                          />
                        </TD>
                        <TD>{model.id}</TD>
                      </TR>
                    ))
                  ) : (
                    <TableEmpty colSpan={2}>没有拉到模型 ID</TableEmpty>
                  )}
                </TBody>
              </Table>
            </>
          ) : (
            <>
              <Button variant="link" onClick={() => setProviderModelsStep(1)}>
                ← 返回模型 ID 列表
              </Button>
              <p className="my-2.5 text-caption text-ink-2">
                已按 Provider 分组展示命中的 pi.dev 模型，勾选要导入的模型后点「批量导入」。
              </p>
              <div className="mb-2.5 flex items-center justify-end gap-2">
                <span className="text-[12px] text-ink-2">已选 {v1CheckedPaths.size} 个</span>
                <Button variant="primary" icon={ArrowDownToLine} onClick={() => void v1BatchImport()}>
                  批量导入
                </Button>
              </div>
              {v1GroupedResults.map((group) => (
                <div key={group.provider} className="mb-4">
                  <div className="mb-1.5 flex items-center gap-2.5 font-semibold">
                    <Checkbox
                      checked={group.models.every((model) => v1CheckedPaths.has(model.detailPath))}
                      onCheckedChange={(checked) =>
                        setV1CheckedPaths((prev) => {
                          const next = new Set(prev);
                          for (const model of group.models) {
                            if (checked) next.add(model.detailPath);
                            else next.delete(model.detailPath);
                          }
                          return next;
                        })
                      }
                    >
                      Provider：{group.provider}
                    </Checkbox>
                    <span className="text-[12px] text-ink-2">{group.models.length} 个命中</span>
                  </div>
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH className="w-[46px]" />
                        <TH className="min-w-[170px]">模型</TH>
                        <TH className="min-w-[220px]">模型 ID</TH>
                        <TH className="w-[110px]">上下文</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {group.models.map((model) => (
                        <TR key={model.detailPath}>
                          <TD>
                            <Checkbox
                              checked={v1CheckedPaths.has(model.detailPath)}
                              onCheckedChange={(checked) =>
                                setV1CheckedPaths((prev) => toggleInSet(prev, model.detailPath, checked))
                              }
                            />
                          </TD>
                          <TD>{model.name}</TD>
                          <TD>{model.id}</TD>
                          <TD>{model.contextWindow}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              ))}
            </>
          )}
        </div>
      </Dialog>

      <Dialog
        open={validationVisible}
        onOpenChange={setValidationVisible}
        title="pi --list-models"
        width={820}
        footer={<Button onClick={() => setValidationVisible(false)}>关闭</Button>}
      >
        <pre className="json-preview">{validationOutput}</pre>
      </Dialog>
    </Page>
  );
}
