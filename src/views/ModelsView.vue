<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Delete, Download, Plus, Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { CatalogModel, ModelConfig } from "../types";

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
const importForm = reactive({ targetProvider: "", baseUrl: "", apiKey: "$CUSTOM_PROVIDER_API_KEY" });
const validationVisible = ref(false);
const validationOutput = ref("");

const providers = computed(() => Object.entries(config.value.providers || {}).map(([id, value]) => ({ id, value })));
const selected = computed(() => config.value.providers[selectedProvider.value]);
const selectedModels = computed(() => Array.isArray(selected.value?.models) ? selected.value.models as Record<string, unknown>[] : []);

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

onMounted(loadConfig);
</script>

<template>
  <section class="page" v-loading="loading">
    <header class="page-header">
      <div class="page-title"><h1>模型管理</h1><p>管理 Pi 的自定义 Provider 和模型配置</p></div>
      <div class="toolbar">
        <el-button :icon="Search" @click="catalogVisible = true">从 pi.dev 导入</el-button>
        <el-button :icon="Refresh" @click="loadConfig">重新加载</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </div>
    </header>

    <el-alert class="path-alert" type="info" :closable="false"><template #title>配置文件：<span class="code">{{ configPath }}</span></template></el-alert>

    <div class="two-column" style="margin-top: 18px">
      <div class="panel">
        <div class="panel-header"><h2>Providers（{{ providers.length }}）</h2><el-button size="small" :icon="Plus" @click="openEditor()">新增</el-button></div>
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
          <div class="panel-header"><h2>{{ selectedProvider }}</h2><div class="toolbar"><el-button size="small" @click="openEditor(selectedProvider)">编辑</el-button><el-button size="small" type="danger" plain :icon="Delete" @click="removeProvider(selectedProvider)">删除</el-button></div></div>
          <div class="panel-body">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Base URL">{{ selected.baseUrl || "使用内置地址" }}</el-descriptions-item>
              <el-descriptions-item label="API">{{ selected.api || "继承内置配置" }}</el-descriptions-item>
              <el-descriptions-item label="API Key">{{ displayApiKey(selected.apiKey) }}</el-descriptions-item>
              <el-descriptions-item label="模型数量">{{ selectedModels.length }}</el-descriptions-item>
            </el-descriptions>
            <h3 style="font-size: 14px; margin: 22px 0 12px">模型列表</h3>
            <el-table :data="selectedModels" border empty-text="没有配置自定义模型">
              <el-table-column prop="id" label="模型 ID" min-width="170" />
              <el-table-column prop="name" label="名称" min-width="130" />
              <el-table-column prop="contextWindow" label="上下文" width="110" />
              <el-table-column prop="maxTokens" label="最大输出" width="110" />
              <el-table-column label="推理" width="72"><template #default="scope">{{ scope.row.reasoning ? "是" : "否" }}</template></el-table-column>
            </el-table>
            <div style="margin-top: 16px"><el-button @click="validateConfig">运行 pi --list-models</el-button></div>
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

    <el-dialog v-model="catalogVisible" title="从 pi.dev 模型目录导入" width="920px" destroy-on-close>
      <div class="toolbar" style="margin-bottom:16px"><el-input v-model="catalogQuery.name" style="width:280px" placeholder="模型名称，如 gpt-5.5" clearable @keyup.enter="searchCatalog" /><el-input v-model="catalogQuery.provider" style="width:210px" placeholder="Provider，如 openai" clearable @keyup.enter="searchCatalog" /><el-button type="primary" :icon="Search" :loading="catalogLoading" @click="searchCatalog">搜索</el-button></div>
      <div v-if="!catalogPreview">
        <el-table :data="catalogResults" height="420" border empty-text="输入名称后搜索">
          <el-table-column prop="name" label="模型" min-width="180" /><el-table-column prop="id" label="模型 ID" min-width="220" /><el-table-column prop="provider" label="Provider" width="160" /><el-table-column prop="contextWindow" label="上下文" width="110" />
          <el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" :icon="Download" @click="selectCatalogModel(scope.row)">获取配置</el-button></template></el-table-column>
        </el-table>
      </div>
      <div v-else v-loading="catalogLoading">
        <el-button link @click="catalogPreview = null">← 返回搜索结果</el-button>
        <el-row :gutter="16" style="margin-top:12px"><el-col :span="8"><el-form label-position="top"><el-form-item label="目标 Provider ID"><el-input v-model="importForm.targetProvider" /></el-form-item><el-form-item label="Base URL"><el-input v-model="importForm.baseUrl" /></el-form-item><el-form-item label="API Key"><el-input v-model="importForm.apiKey" show-password /></el-form-item></el-form></el-col><el-col :span="16"><pre class="json-preview">{{ JSON.stringify(catalogPreview, null, 2) }}</pre></el-col></el-row>
      </div>
      <template #footer><el-button @click="catalogVisible = false">取消</el-button><el-button v-if="catalogPreview" type="primary" @click="importCatalogConfig">导入配置</el-button></template>
    </el-dialog>

    <el-dialog v-model="validationVisible" title="pi --list-models" width="820px"><pre class="json-preview">{{ validationOutput }}</pre></el-dialog>
  </section>
</template>
