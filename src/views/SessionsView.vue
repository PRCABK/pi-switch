<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Archive, ArrowDownToLine, MoreHorizontal, Pencil, Play, RefreshCw, Search, Trash2 } from "@lucide/vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { DisplayEntry, SessionDetail, SessionSummary } from "../types";

const loading = ref(false);
const detailLoading = ref(false);
const sessions = ref<SessionSummary[]>([]);
const selectedPath = ref("");
const detail = ref<SessionDetail | null>(null);
const keyword = ref("");
const activeOnly = ref(true);

const filteredSessions = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return sessions.value;
  return sessions.value.filter((session) => [session.name, session.id, session.cwd, session.firstMessage, session.model, session.provider]
    .some((value) => value?.toLowerCase().includes(query)));
});

const displayEntries = computed(() => {
  if (!detail.value) return [];
  return activeOnly.value ? detail.value.entries.filter((entry) => entry.active) : detail.value.entries;
});

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

function formatTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTokens(value: number): string {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : String(value);
}

async function loadSessions(keepSelection = true) {
  loading.value = true;
  try {
    const previous = keepSelection ? selectedPath.value : "";
    sessions.value = await api.listSessions(loadSettings().sessionsDir || undefined);
    if (previous && sessions.value.some((session) => session.path === previous)) {
      await selectSession(sessions.value.find((session) => session.path === previous)!);
    } else if (sessions.value.length) {
      await selectSession(sessions.value[0]);
    } else {
      selectedPath.value = "";
      detail.value = null;
    }
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    loading.value = false;
  }
}

async function selectSession(session: SessionSummary) {
  selectedPath.value = session.path;
  detailLoading.value = true;
  try {
    detail.value = await api.getSessionDetail(session.path);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    detailLoading.value = false;
  }
}

async function continueSession() {
  if (!detail.value) return;
  try {
    const settings = loadSettings();
    await api.continueSession(detail.value.summary.id, detail.value.summary.cwd, settings.piPath || undefined);
    ElMessage.success("已在外部终端打开 Pi");
  } catch (error) {
    ElMessage.error(errorText(error));
  }
}

async function renameSession() {
  if (!detail.value) return;
  try {
    const result = await ElMessageBox.prompt("请输入新的会话名称", "重命名", {
      inputValue: detail.value.summary.name || "",
      inputValidator: (value) => Boolean(value.trim()) || "名称不能为空",
    });
    await api.renameSession(detail.value.summary.path, result.value);
    await loadSessions(true);
    ElMessage.success("会话名称已更新");
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(errorText(error));
  }
}

async function deleteSession() {
  if (!detail.value) return;
  try {
    await ElMessageBox.confirm("将永久删除此 Session JSONL 文件，是否继续？", "删除会话", { type: "warning", confirmButtonText: "删除" });
    await api.deleteSession(detail.value.summary.path);
    selectedPath.value = "";
    await loadSessions(false);
    ElMessage.success("会话已删除");
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(errorText(error));
  }
}

async function exportSession() {
  if (!detail.value) return;
  try {
    const result = await api.exportSession(detail.value.summary.path, loadSettings().piPath || undefined);
    if (result.success) ElMessage.success(`已导出到 ${result.output}`);
    else ElMessage.error(result.output || "导出失败");
  } catch (error) {
    ElMessage.error(errorText(error));
  }
}

function messageClass(entry: DisplayEntry): string[] {
  return ["message", entry.role || entry.entryType, entry.active ? "" : "inactive-branch"];
}

onMounted(() => loadSessions(false));
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div class="page-title"><h1>对话管理</h1><p>浏览、管理并继续 Pi 历史 Session</p></div>
      <div class="toolbar"><el-button :icon="RefreshCw" :loading="loading" @click="loadSessions(true)">刷新</el-button></div>
    </header>

    <div class="session-grid">
      <div class="panel">
        <div class="panel-header">
          <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索名称、ID、项目或模型" />
          <span class="muted" style="white-space:nowrap;font-size:12px">{{ filteredSessions.length }} 个</span>
        </div>
        <div class="session-list" v-loading="loading">
          <div v-if="!filteredSessions.length" class="empty-state">没有找到 Session</div>
          <article v-for="session in filteredSessions" :key="session.path" class="session-item" :class="{ active: selectedPath === session.path }" @click="selectSession(session)">
            <div class="session-item-title"><strong>{{ session.name || session.firstMessage || "未命名会话" }}</strong><span class="muted">{{ formatTime(session.modifiedAt) }}</span></div>
            <div class="session-item-text">{{ session.firstMessage || session.cwd }}</div>
            <div class="session-item-meta"><span>{{ session.provider && session.model ? `${session.provider}/${session.model}` : session.id }}</span><span>{{ session.messageCount }} 条 · {{ formatTokens(session.totalTokens) }}</span></div>
          </article>
        </div>
      </div>

      <div class="panel" v-loading="detailLoading">
        <template v-if="detail">
          <div class="panel-header">
            <div style="min-width:0"><h2 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ detail.summary.name || detail.summary.firstMessage || "未命名会话" }}</h2><div class="muted code" style="margin-top:5px;font-size:11px;user-select:text">pi --session {{ detail.summary.id }}</div></div>
            <div class="toolbar">
              <el-button size="small" type="primary" :icon="Play" @click="continueSession">继续对话</el-button>
              <el-dropdown trigger="click">
                <el-button size="small" :icon="MoreHorizontal" aria-label="更多操作"></el-button>
                <template #dropdown><el-dropdown-menu><el-dropdown-item :icon="Pencil" @click="renameSession">重命名</el-dropdown-item><el-dropdown-item :icon="ArrowDownToLine" @click="exportSession">导出 HTML</el-dropdown-item><el-dropdown-item :icon="Trash2" divided @click="deleteSession">删除</el-dropdown-item></el-dropdown-menu></template>
              </el-dropdown>
            </div>
          </div>
          <div class="detail-meta">
            <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap"><span class="code" :title="detail.summary.cwd">{{ detail.summary.cwd }}</span><span>{{ detail.summary.messageCount }} 条消息 · {{ formatTokens(detail.summary.totalTokens) }} tokens · ${{ detail.summary.totalCost.toFixed(4) }}</span></div>
            <el-checkbox v-model="activeOnly" size="small" style="margin-top:8px">仅显示当前活动分支</el-checkbox>
          </div>
          <div class="conversation">
            <article v-for="entry in displayEntries" :key="entry.id" :class="messageClass(entry)">
              <div class="message-card" :style="entry.isError ? 'border-color:#ef9a9a;background:#fff5f5' : ''"><div class="message-accent"><Archive :size="13" /></div>
                <div class="message-head"><strong>{{ entry.title }}<span v-if="entry.toolName"> · {{ entry.toolName }}</span></strong><span>{{ formatTime(entry.timestamp) }}<template v-if="!entry.active"> · 历史分支</template></span></div>
                <p v-if="entry.text" class="message-text">{{ entry.text }}</p>
                <el-collapse v-if="entry.thinking" style="margin-top:8px"><el-collapse-item title="查看思考内容"><p class="message-text muted">{{ entry.thinking }}</p></el-collapse-item></el-collapse>
                <div v-if="entry.provider && entry.model" class="muted code" style="margin-top:8px;font-size:10px">{{ entry.provider }}/{{ entry.model }}</div>
              </div>
            </article>
            <div v-if="!displayEntries.length" class="empty-state">此 Session 没有可显示的记录</div>
          </div>
        </template>
        <div v-else class="empty-state">选择一个 Session 查看对话</div>
      </div>
    </div>
  </section>
</template>
