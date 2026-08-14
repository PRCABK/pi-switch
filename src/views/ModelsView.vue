<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ArrowDownToLine, Database, Pencil, Plus, RefreshCw, Search, Save, Trash2, Wrench } from "@lucide/vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { CatalogModel, ModelConfig, ProviderModel } from "../types";

const loading = ref(false);
const saving = ref(false);
const config = ref<ModelConfig>({ providers: {} });
const configPath = ref("");
const selectedProvider = ref("");
const editorVisible = ref(false);
const editorOriginalId = ref("");
const editor = reactive({ id: "", baseUrl: "", apiKey: "", api: "openai-completions", authHeader: false, headers: "{}", models: "[]" });
const catalogVisible = ref(false);
const catalogLoading = ref(false);
const catalogQuery = reactive({ name: "", provider: "" });
const catalogResults = ref<CatalogModel[]>([]);
const catalogPreview = ref<ModelConfig | null>(null);
const catalogSelected = ref<CatalogModel | null>(null);
const catalogSelectedRows = ref<CatalogModel[]>([]);
const catalogBatchLoading = ref(false);
const importForm = reactive({ targetProvider: "", baseUrl: "", apiKey: "$CUSTOM_PROVIDER_API_KEY" });
const validationVisible = ref(false);
const validationOutput = ref("");

const providerModelsVisible = ref(false);
const providerModelsLoading = ref(false);
const providerModels = ref<ProviderModel[]>([]);
const providerModelsStep = ref<1 | 2>(1);
const providerModelsSelectedIds = ref<string[]>([]);
const v1SearchLoading = ref(false);
const v1GroupedResults = ref<{ provider: string; models: CatalogModel[] }[]>([]);
const v1CheckedPaths = ref<Set<string>>(new Set());

const providers = computed(() => Object.entries(config.value.providers || {}).map(([id, value]) => ({ id, value })));
const selected = computed(() => config.value.providers[selectedProvider.value]);
const selectedModels = computed(() => Array.isArray(selected.value?.models) ? selected.value.models as Record<string, unknown>[] : []);

const modelDialogVisible = ref(false);
const editingModelIndex = ref(-1);
const modelForm = reactive({
  id: "",
  name: "",
  reasoning: false,
  input: ["text"] as string[],
  contextWindow: 128000,
  maxTokens: 16384,
  costInput: 0,
  costOutput: 0,
  costCacheRead: 0,
  costCacheWrite: 0,
});

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

function displayApiKey(value: unknown): string {
  const key = String(value || "");
  if (!key) return "通过 Pi 登录或 CLI 提供";
  return key.startsWith("$") || key.startsWith("!") ? key : "已配置明文密钥（已隐藏）";
}

async function loadConfig() {
  loading.value = true;
  try {
    const settings = loadSettings();
    const result = await api.readModelConfig(settings.modelsPath || undefined);
    config.value = result.config;
    config.value.providers ||= {};
    configPath.value = result.path;
    if (!selectedProvider.value || !config.value.providers[selectedProvider.value]) {
      selectedProvider.value = Object.keys(config.value.providers)[0] || "";
    }
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    loading.value = false;
  }
}

function openEditor(id?: string) {
  const value = id ? config.value.providers[id] || {} : {};
  editorOriginalId.value = id || "";
  editor.id = id || "";
  editor.baseUrl = String(value.baseUrl || "");
  editor.apiKey = String(value.apiKey || "");
  editor.api = String(value.api || "openai-completions");
  editor.authHeader = Boolean(value.authHeader);
  editor.headers = JSON.stringify(value.headers || {}, null, 2);
  editor.models = JSON.stringify(value.models || [], null, 2);
  editorVisible.value = true;
}

function applyEditor() {
  const id = editor.id.trim();
  if (!id) return ElMessage.warning("请输入 Provider ID");
  if (id !== editorOriginalId.value && config.value.providers[id]) return ElMessage.warning("Provider ID 已存在");
  try {
    const headers = JSON.parse(editor.headers || "{}");
    const models = JSON.parse(editor.models || "[]");
    if (!Array.isArray(models)) throw new Error("模型配置必须是数组");
    const previous = editorOriginalId.value ? config.value.providers[editorOriginalId.value] || {} : {};
    const next: Record<string, unknown> = { ...previous, api: editor.api, models };
    if (editor.baseUrl.trim()) next.baseUrl = editor.baseUrl.trim(); else delete next.baseUrl;
    if (editor.apiKey.trim()) next.apiKey = editor.apiKey.trim(); else delete next.apiKey;
    if (editor.authHeader) next.authHeader = true; else delete next.authHeader;
    if (Object.keys(headers).length) next.headers = headers; else delete next.headers;
    if (editorOriginalId.value && editorOriginalId.value !== id) delete config.value.providers[editorOriginalId.value];
    config.value.providers[id] = next;
    selectedProvider.value = id;
    editorVisible.value = false;
  } catch (error) {
    ElMessage.error(`JSON 配置有误：${errorText(error)}`);
  }
}

async function removeProvider(id: string) {
  try {
    await ElMessageBox.confirm(`确定删除 Provider “${id}”吗？保存配置后才会写入磁盘。`, "删除确认", { type: "warning" });
    delete config.value.providers[id];
    selectedProvider.value = Object.keys(config.value.providers)[0] || "";
  } catch { /* 用户取消 */ }
}

function updateProviderModels(models: Record<string, unknown>[]) {
  const provider = config.value.providers[selectedProvider.value];
  if (provider) provider.models = models;
}

function openModelEditor(index?: number) {
  const model = index !== undefined && index >= 0 ? selectedModels.value[index] : null;
  const cost = (model?.cost as Record<string, unknown> | undefined) ?? {};
  modelForm.id = String(model?.id ?? "");
  modelForm.name = String(model?.name ?? "");
  modelForm.reasoning = Boolean(model?.reasoning);
  modelForm.input = Array.isArray(model?.input) ? [...(model.input as string[])] : ["text"];
  modelForm.contextWindow = Number(model?.contextWindow ?? 128000);
  modelForm.maxTokens = Number(model?.maxTokens ?? 16384);
  modelForm.costInput = Number(cost.input ?? 0);
  modelForm.costOutput = Number(cost.output ?? 0);
  modelForm.costCacheRead = Number(cost.cacheRead ?? 0);
  modelForm.costCacheWrite = Number(cost.cacheWrite ?? 0);
  editingModelIndex.value = index ?? -1;
  modelDialogVisible.value = true;
}

function applyModel() {
  const id = modelForm.id.trim();
  if (!id) return ElMessage.warning("请输入模型 ID");
  const duplicate = selectedModels.value.some((model, i) => String(model.id) === id && i !== editingModelIndex.value);
  if (duplicate) return ElMessage.warning("模型 ID 已存在");
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
  const models = [...selectedModels.value];
  if (editingModelIndex.value >= 0) {
    const original = models[editingModelIndex.value] ?? {};
    models[editingModelIndex.value] = { ...original, ...model };
  } else {
    models.push(model);
  }
  updateProviderModels(models);
  modelDialogVisible.value = false;
  ElMessage.success("模型已更新，点击“保存配置”写入磁盘");
}

async function removeModel(index: number) {
  try {
    await ElMessageBox.confirm("确定删除该模型吗？保存配置后才会写入磁盘。", "删除确认", { type: "warning" });
    const models = [...selectedModels.value];
    models.splice(index, 1);
    updateProviderModels(models);
  } catch { /* 用户取消 */ }
}

async function saveConfig() {
  saving.value = true;
  try {
    const backup = await api.saveModelConfig(config.value, configPath.value);
    ElMessage.success(backup ? `保存成功，已备份到 ${backup}` : "保存成功");
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    saving.value = false;
  }
}

async function openProviderModels() {
  if (!selected.value) return ElMessage.warning("请先选择一个 Provider");
  const baseUrl = String(selected.value.baseUrl || "");
  if (!baseUrl) return ElMessage.warning("当前 Provider 未配置 Base URL");
  providerModelsVisible.value = true;
  providerModels.value = [];
  providerModelsStep.value = 1;
  providerModelsSelectedIds.value = [];
  v1GroupedResults.value = [];
  v1CheckedPaths.value = new Set();
  providerModelsLoading.value = true;
  try {
    const result = await api.fetchProviderModels(
      baseUrl,
      String(selected.value.apiKey || ""),
    );
    providerModels.value = result;
    if (!result.length) ElMessage.info("/v1/models 返回的列表为空");
  } catch (error) {
    ElMessage.error(errorText(error));
    providerModelsVisible.value = false;
  } finally {
    providerModelsLoading.value = false;
  }
}

async function v1SearchSelected() {
  if (!providerModelsSelectedIds.value.length) return ElMessage.warning("请先勾选要查询的模型 ID");
  v1SearchLoading.value = true;
  v1GroupedResults.value = [];
  v1CheckedPaths.value = new Set();
  try {
    const grouped = new Map<string, CatalogModel[]>();
    for (const id of providerModelsSelectedIds.value) {
      try {
        const hits = await api.searchCatalog(id, undefined);
        for (const hit of hits) {
          if (!grouped.has(hit.provider)) grouped.set(hit.provider, []);
          grouped.get(hit.provider)!.push(hit);
        }
      } catch (error) {
        console.error(`搜索 ${id} 失败`, error);
      }
    }
    v1GroupedResults.value = [...grouped.entries()].map(([provider, models]) => ({ provider, models }));
    if (v1GroupedResults.value.length) providerModelsStep.value = 2;
    else ElMessage.info("未在 pi.dev 匹配到任何模型");
  } finally {
    v1SearchLoading.value = false;
  }
}

function v1TogglePath(path: string, checked: boolean) {
  if (checked) v1CheckedPaths.value.add(path);
  else v1CheckedPaths.value.delete(path);
  v1CheckedPaths.value = new Set(v1CheckedPaths.value);
}

function v1ToggleProvider(provider: string, checked: boolean) {
  const group = v1GroupedResults.value.find((item) => item.provider === provider);
  if (!group) return;
  for (const model of group.models) {
    if (checked) v1CheckedPaths.value.add(model.detailPath);
    else v1CheckedPaths.value.delete(model.detailPath);
  }
  v1CheckedPaths.value = new Set(v1CheckedPaths.value);
}

async function v1BatchImport() {
  if (!v1CheckedPaths.value.size) return ElMessage.warning("请勾选要导入的模型");
  if (!selectedProvider.value) return ElMessage.warning("请先选择目标 Provider");
  providerModelsLoading.value = true;
  let imported = 0;
  let failed = 0;
  try {
    for (const detailPath of v1CheckedPaths.value) {
      try {
        const preview = await api.fetchCatalogConfig(detailPath);
        const sourceId = Object.keys(preview.providers)[0];
        const source = preview.providers[sourceId] || {};
        mergeIntoProvider(selectedProvider.value, source, config.value.providers[selectedProvider.value] || {});
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`导入 ${detailPath} 失败`, error);
      }
    }
    if (imported) ElMessage.success(`已导入 ${imported} 个模型${failed ? `，${failed} 个失败` : ""}，请确认后保存`);
    else ElMessage.error("全部导入失败");
    if (imported) providerModelsVisible.value = false;
  } finally {
    providerModelsLoading.value = false;
  }
}

async function validateConfig() {
  try {
    const result = await api.validateModels(loadSettings().piPath || undefined);
    validationOutput.value = result.output || (result.success ? "验证通过" : "验证失败");
    validationVisible.value = true;
    if (!result.success) ElMessage.warning("pi --list-models 执行失败");
  } catch (error) {
    ElMessage.error(errorText(error));
  }
}

async function searchCatalog() {
  if (!catalogQuery.name.trim()) return ElMessage.warning("请输入模型名称");
  catalogLoading.value = true;
  catalogPreview.value = null;
  try {
    catalogResults.value = await api.searchCatalog(catalogQuery.name, catalogQuery.provider || undefined);
    if (!catalogResults.value.length) ElMessage.info("没有找到匹配模型");
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    catalogLoading.value = false;
  }
}

async function selectCatalogModel(model: CatalogModel) {
  catalogLoading.value = true;
  try {
    const preview = await api.fetchCatalogConfig(model.detailPath);
    catalogSelected.value = model;
    catalogPreview.value = preview;
    const sourceId = Object.keys(preview.providers)[0] || model.provider;
    const source = preview.providers[sourceId] || {};
    importForm.targetProvider = selectedProvider.value || sourceId;
    importForm.baseUrl = String(config.value.providers[importForm.targetProvider]?.baseUrl || source.baseUrl || "");
    importForm.apiKey = String(config.value.providers[importForm.targetProvider]?.apiKey || "$CUSTOM_PROVIDER_API_KEY");
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    catalogLoading.value = false;
  }
}

function importCatalogConfig() {
  const preview = catalogPreview.value;
  const target = importForm.targetProvider.trim();
  if (!preview || !target) return ElMessage.warning("请输入目标 Provider ID");
  const sourceId = Object.keys(preview.providers)[0];
  const source = preview.providers[sourceId] || {};
  const existing = config.value.providers[target] || {};
  const sourceModels = Array.isArray(source.models) ? source.models as Record<string, unknown>[] : [];
  const existingModels = Array.isArray(existing.models) ? existing.models as Record<string, unknown>[] : [];
  const byId = new Map<string, Record<string, unknown>>();
  existingModels.forEach((model) => byId.set(String(model.id), model));
  const sourceApi = typeof source.api === "string" ? source.api : "";
  const targetApi = typeof existing.api === "string" ? existing.api : sourceApi;
  sourceModels.forEach((model) => {
    const imported = sourceApi && targetApi && sourceApi !== targetApi ? { ...model, api: sourceApi } : model;
    byId.set(String(model.id), imported);
  });
  const merged: Record<string, unknown> = { ...source, ...existing, models: [...byId.values()] };
  if (importForm.baseUrl.trim()) merged.baseUrl = importForm.baseUrl.trim();
  if (importForm.apiKey.trim()) merged.apiKey = importForm.apiKey.trim();
  config.value.providers[target] = merged;
  selectedProvider.value = target;
  catalogVisible.value = false;
  ElMessage.success(`已导入 ${catalogSelected.value?.name || "模型"}，请确认后保存`);
}

function catalogSelectionChange(rows: CatalogModel[]) {
  catalogSelectedRows.value = rows;
}

async function batchImportCatalog() {
  const rows = catalogSelectedRows.value;
  if (!rows.length) return ElMessage.warning("请先勾选要导入的模型");
  if (!selectedProvider.value) return ElMessage.warning("请先选择目标 Provider");
  catalogBatchLoading.value = true;
  let imported = 0;
  let failed = 0;
  try {
    for (const row of rows) {
      try {
        const preview = await api.fetchCatalogConfig(row.detailPath);
        const sourceId = Object.keys(preview.providers)[0];
        const source = preview.providers[sourceId] || {};
        mergeIntoProvider(selectedProvider.value, source, config.value.providers[selectedProvider.value] || {});
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`导入 ${row.name} 失败`, error);
      }
    }
    if (imported) ElMessage.success(`已导入 ${imported} 个模型${failed ? `，${failed} 个失败` : ""}，请确认后保存`);
    else ElMessage.error("全部导入失败");
    if (imported) catalogVisible.value = false;
  } finally {
    catalogBatchLoading.value = false;
  }
}

function mergeIntoProvider(targetId: string, source: Record<string, unknown>, existing: Record<string, unknown>) {
  const sourceApi = typeof source.api === "string" ? source.api : "";
  const targetApi = typeof existing.api === "string" ? existing.api : sourceApi;
  const sourceModels = Array.isArray(source.models) ? source.models as Record<string, unknown>[] : [];
  const existingModels = Array.isArray(existing.models) ? existing.models as Record<string, unknown>[] : [];
  const byId = new Map<string, Record<string, unknown>>();
  existingModels.forEach((model) => byId.set(String(model.id), model));
  sourceModels.forEach((model) => {
    const imported = sourceApi && targetApi && sourceApi !== targetApi ? { ...model, api: sourceApi } : model;
    byId.set(String(model.id), imported);
  });
  const merged: Record<string, unknown> = { ...source, ...existing, models: [...byId.values()] };
  const current = config.value.providers[targetId] || {};
  if (current.baseUrl) merged.baseUrl = current.baseUrl;
  if (current.apiKey) merged.apiKey = current.apiKey;
  config.value.providers[targetId] = merged;
}

onMounted(loadConfig);
</script>

<template>
  <section class="page" v-loading="loading">
    <header class="page-header">
      <div class="page-title"><h1>模型管理</h1><p>管理 Pi 的自定义 Provider 和模型配置</p></div>
      <div class="toolbar">
        <el-button :icon="Search" @click="catalogVisible = true">从 pi.dev 导入</el-button>
        <el-button :icon="RefreshCw" @click="loadConfig">重新加载</el-button>
        <el-button type="primary" :loading="saving" :icon="Save" @click="saveConfig">保存配置</el-button>
      </div>
    </header>

    <el-alert class="path-alert" type="info" :closable="false"><template #title>配置文件：<span class="code">{{ configPath }}</span></template></el-alert>

    <div class="two-column" style="margin-top: 18px">
      <div class="panel">
        <div class="panel-header"><h2><Database :size="15" /> Providers <span class="count-mark">{{ String(providers.length).padStart(2, "0") }}</span></h2><el-button size="small" :icon="Plus" @click="openEditor()">新增</el-button></div>
        <div class="panel-body">
          <div v-if="!providers.length" class="empty-state">还没有自定义 Provider</div>
          <div v-for="provider in providers" :key="provider.id" class="provider-card" :class="{ active: selectedProvider === provider.id }" @click="selectedProvider = provider.id">
            <div class="provider-name"><span>{{ provider.id }}</span><el-tag size="small" effect="plain">{{ provider.value.api || "继承" }}</el-tag></div>
            <div class="provider-meta">{{ provider.value.baseUrl || "使用内置地址" }}</div>
            <div class="provider-meta">{{ Array.isArray(provider.value.models) ? provider.value.models.length : 0 }} 个自定义模型</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <template v-if="selected">
          <div class="panel-header"><h2><span class="section-kicker">ACTIVE PROVIDER</span>{{ selectedProvider }}</h2><div class="toolbar"><el-button size="small" :icon="RefreshCw" @click="openProviderModels">从 /v1/models 获取</el-button><el-button size="small" :icon="Pencil" @click="openEditor(selectedProvider)">编辑</el-button><el-button size="small" type="danger" plain :icon="Trash2" @click="removeProvider(selectedProvider)">删除</el-button></div></div>
          <div class="panel-body">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Base URL">{{ selected.baseUrl || "使用内置地址" }}</el-descriptions-item>
              <el-descriptions-item label="API">{{ selected.api || "继承内置配置" }}</el-descriptions-item>
              <el-descriptions-item label="API Key">{{ displayApiKey(selected.apiKey) }}</el-descriptions-item>
              <el-descriptions-item label="模型数量">{{ selectedModels.length }}</el-descriptions-item>
            </el-descriptions>
            <div class="subsection-head"><h3><span class="section-kicker">CATALOG</span>模型列表</h3><el-button size="small" type="primary" :icon="Plus" @click="openModelEditor()">新增模型</el-button></div>
            <el-table :data="selectedModels" border empty-text="没有配置自定义模型">
              <el-table-column prop="id" label="模型 ID" min-width="170" />
              <el-table-column prop="name" label="名称" min-width="130" />
              <el-table-column prop="contextWindow" label="上下文" width="110" />
              <el-table-column prop="maxTokens" label="最大输出" width="110" />
              <el-table-column label="推理" width="72"><template #default="scope">{{ scope.row.reasoning ? "是" : "否" }}</template></el-table-column>
              <el-table-column label="操作" width="130"><template #default="scope"><el-button link type="primary" :icon="Pencil" @click="openModelEditor(scope.$index)">编辑</el-button><el-button link type="danger" :icon="Trash2" @click="removeModel(scope.$index)">删除</el-button></template></el-table-column>
            </el-table>
            <div class="validation-action"><el-button :icon="Wrench" @click="validateConfig">运行 pi --list-models</el-button><span>写入前建议先校验当前配置</span></div>
          </div>
        </template>
        <div v-else class="empty-state">选择或新增一个 Provider</div>
      </div>
    </div>

    <el-dialog v-model="editorVisible" :title="editorOriginalId ? '编辑 Provider' : '新增 Provider'" width="720px" destroy-on-close>
      <el-form label-position="top">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="Provider ID"><el-input v-model="editor.id" placeholder="custom-provider" /></el-form-item></el-col><el-col :span="12"><el-form-item label="API 类型"><el-select v-model="editor.api" style="width:100%"><el-option v-for="item in ['openai-completions','openai-responses','anthropic-messages','google-generative-ai']" :key="item" :value="item" /></el-select></el-form-item></el-col></el-row>
        <el-form-item label="Base URL"><el-input v-model="editor.baseUrl" placeholder="https://api.example.com/v1" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="editor.apiKey" placeholder="$CUSTOM_PROVIDER_API_KEY" show-password /><div class="muted" style="font-size:12px;margin-top:6px">建议使用环境变量引用，不要保存明文 Key。</div></el-form-item>
        <el-form-item><el-checkbox v-model="editor.authHeader">自动添加 Authorization: Bearer 请求头</el-checkbox></el-form-item>
        <el-form-item label="自定义 Headers（JSON 对象）"><el-input v-model="editor.headers" type="textarea" :rows="4" class="code" /></el-form-item>
        <el-form-item label="模型配置（JSON 数组）"><el-input v-model="editor.models" type="textarea" :rows="12" class="code" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editorVisible = false">取消</el-button><el-button type="primary" @click="applyEditor">应用</el-button></template>
    </el-dialog>

    <el-dialog v-model="modelDialogVisible" :title="editingModelIndex >= 0 ? '编辑模型' : '新增模型'" width="640px" destroy-on-close>
      <el-form label-position="top">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="模型 ID"><el-input v-model="modelForm.id" placeholder="gpt-5.5" /></el-form-item></el-col><el-col :span="12"><el-form-item label="显示名称"><el-input v-model="modelForm.name" placeholder="GPT-5.5" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="支持推理"><el-switch v-model="modelForm.reasoning" /></el-form-item></el-col><el-col :span="12"><el-form-item label="输入类型"><el-select v-model="modelForm.input" multiple style="width:100%"><el-option label="文本" value="text" /><el-option label="图片" value="image" /></el-select></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="上下文窗口"><el-input-number v-model="modelForm.contextWindow" :min="1" :step="1000" style="width:100%" /></el-form-item></el-col><el-col :span="12"><el-form-item label="最大输出 Tokens"><el-input-number v-model="modelForm.maxTokens" :min="1" :step="1000" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="价格（美元 / 百万 tokens）">
          <div class="toolbar"><el-input-number v-model="modelForm.costInput" :min="0" :precision="4" :step="0.5" /><span class="muted" style="font-size:12px">输入</span><el-input-number v-model="modelForm.costOutput" :min="0" :precision="4" :step="0.5" /><span class="muted" style="font-size:12px">输出</span></div>
          <div class="toolbar" style="margin-top:10px"><el-input-number v-model="modelForm.costCacheRead" :min="0" :precision="4" :step="0.5" /><span class="muted" style="font-size:12px">缓存读取</span><el-input-number v-model="modelForm.costCacheWrite" :min="0" :precision="4" :step="0.5" /><span class="muted" style="font-size:12px">缓存写入</span></div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="modelDialogVisible = false">取消</el-button><el-button type="primary" @click="applyModel">应用</el-button></template>
    </el-dialog>

    <el-dialog v-model="catalogVisible" title="从 pi.dev 模型目录导入" width="920px" destroy-on-close>
      <div class="toolbar catalog-toolbar"><el-input v-model="catalogQuery.name" style="width:280px" placeholder="模型名称，如 gpt-5.5" clearable @keyup.enter="searchCatalog" /><el-input v-model="catalogQuery.provider" style="width:210px" placeholder="Provider，如 openai" clearable @keyup.enter="searchCatalog" /><el-button type="primary" :icon="Search" :loading="catalogLoading" @click="searchCatalog">搜索</el-button><span v-if="catalogSelectedRows.length" class="muted" style="font-size:12px">已选 {{ catalogSelectedRows.length }} 个</span></div>
      <div v-if="!catalogPreview">
        <div v-if="catalogSelectedRows.length" class="toolbar" style="justify-content:flex-end;margin-bottom:10px"><el-button type="primary" :icon="ArrowDownToLine" :loading="catalogBatchLoading" @click="batchImportCatalog">批量导入选中</el-button></div>
        <el-table :data="catalogResults" height="420" border empty-text="输入名称后搜索" @selection-change="catalogSelectionChange">
          <el-table-column type="selection" width="46" />
          <el-table-column prop="name" label="模型" min-width="180" /><el-table-column prop="id" label="模型 ID" min-width="220" /><el-table-column prop="provider" label="Provider" width="160" /><el-table-column prop="contextWindow" label="上下文" width="110" />
          <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" :icon="ArrowDownToLine" @click="selectCatalogModel(scope.row)">获取配置</el-button></template></el-table-column>
        </el-table>
      </div>
      <div v-else v-loading="catalogLoading">
        <el-button link @click="catalogPreview = null">← 返回搜索结果</el-button>
        <el-row :gutter="16" style="margin-top:12px"><el-col :span="8"><el-form label-position="top"><el-form-item label="目标 Provider ID"><el-input v-model="importForm.targetProvider" /></el-form-item><el-form-item label="Base URL"><el-input v-model="importForm.baseUrl" /></el-form-item><el-form-item label="API Key"><el-input v-model="importForm.apiKey" show-password /></el-form-item></el-form></el-col><el-col :span="16"><pre class="json-preview">{{ JSON.stringify(catalogPreview, null, 2) }}</pre></el-col></el-row>
      </div>
      <template #footer><el-button @click="catalogVisible = false">取消</el-button><el-button v-if="catalogPreview" type="primary" @click="importCatalogConfig">导入配置</el-button></template>
    </el-dialog>

    <el-dialog v-model="providerModelsVisible" title="从 Provider /v1/models 获取模型" width="960px" destroy-on-close>
      <div v-loading="providerModelsLoading">
        <div v-if="providerModelsStep === 1">
          <p class="muted" style="font-size:13px;margin-bottom:10px">已从 <span class="code">{{ selected?.baseUrl }}/models</span> 拉到 {{ providerModels.length }} 个模型 ID。勾选后用这些 ID 去 pi.dev 精准搜索，再按 Provider 分组选择导入。</p>
          <div class="toolbar" style="justify-content:flex-end;margin-bottom:10px"><span class="muted" style="font-size:12px">已选 {{ providerModelsSelectedIds.length }} / {{ providerModels.length }}</span><el-button type="primary" :icon="Search" :loading="v1SearchLoading" :disabled="!providerModelsSelectedIds.length" @click="v1SearchSelected">搜索 pi.dev</el-button></div>
          <el-table :data="providerModels" height="440" border empty-text="没有拉到模型 ID" @selection-change="(rows: ProviderModel[]) => providerModelsSelectedIds = rows.map((r: ProviderModel) => r.id)">
            <el-table-column type="selection" width="46" />
            <el-table-column prop="id" label="模型 ID" />
          </el-table>
        </div>
        <div v-else>
          <el-button link @click="providerModelsStep = 1">← 返回模型 ID 列表</el-button>
          <p class="muted" style="font-size:13px;margin:10px 0">已按 Provider 分组展示命中的 pi.dev 模型，勾选要导入的模型后点「批量导入」。</p>
          <div class="toolbar" style="justify-content:flex-end;margin-bottom:10px"><span class="muted" style="font-size:12px">已选 {{ v1CheckedPaths.size }} 个</span><el-button type="primary" :icon="ArrowDownToLine" @click="v1BatchImport">批量导入</el-button></div>
          <div v-for="group in v1GroupedResults" :key="group.provider" class="v1-group">
            <div class="v1-group-head"><el-checkbox :model-value="group.models.every((m) => v1CheckedPaths.has(m.detailPath))" @change="(val: boolean) => v1ToggleProvider(group.provider, Boolean(val))">Provider：{{ group.provider }}</el-checkbox><span class="muted" style="font-size:12px">{{ group.models.length }} 个命中</span></div>
            <el-table :data="group.models" border size="small">
              <el-table-column width="46"><template #default="scope"><el-checkbox :model-value="v1CheckedPaths.has(scope.row.detailPath)" @change="(val: boolean) => v1TogglePath(scope.row.detailPath, Boolean(val))" /></template></el-table-column>
              <el-table-column prop="name" label="模型" min-width="170" />
              <el-table-column prop="id" label="模型 ID" min-width="220" />
              <el-table-column prop="contextWindow" label="上下文" width="110" />
            </el-table>
          </div>
        </div>
      </div>
      <template #footer><el-button @click="providerModelsVisible = false">取消</el-button></template>
    </el-dialog>

    <el-dialog v-model="validationVisible" title="pi --list-models" width="820px"><pre class="json-preview">{{ validationOutput }}</pre></el-dialog>
  </section>
</template>

<style scoped>
.v1-group { margin-bottom: 16px; }
.v1-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-weight: 600; }
</style>
