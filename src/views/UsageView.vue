<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, ChartColumn, CircleDollarSign, MessagesSquare, RefreshCw } from "@lucide/vue";
import { ElMessage } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { UsageStats } from "../types";

const loading = ref(false);
const range = ref<"7" | "30" | "all">("30");
const stats = ref<UsageStats | null>(null);

const chartDays = computed(() => {
  const days = stats.value?.daily ?? [];
  return range.value === "all" ? days : days.slice(-Number(range.value));
});
const maxDailyTokens = computed(() => Math.max(1, ...chartDays.value.map((day) => day.totalTokens)));
const maxModelTokens = computed(() => Math.max(1, ...(stats.value?.models.map((model) => model.totalTokens) ?? [])));
const maxProviderTokens = computed(() => Math.max(1, ...(stats.value?.providers.map((provider) => provider.totalTokens) ?? [])));
const hasUsage = computed(() => Boolean(stats.value?.totals.requests));
const tokenMix = computed(() => {
  const totals = stats.value?.totals;
  if (!totals) return [];
  return [
    { label: "输入", value: totals.inputTokens, tone: "rose" },
    { label: "输出", value: totals.outputTokens, tone: "violet" },
    { label: "缓存读取", value: totals.cacheReadTokens, tone: "cyan" },
    { label: "缓存写入", value: totals.cacheWriteTokens, tone: "mist" },
  ];
});

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatFullTokens(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCost(value: number): string {
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

function dayLabel(value: string): string {
  return value.slice(5).replace("-", "/");
}

function showDayLabel(index: number): boolean {
  return chartDays.value.length <= 10 || index % 5 === 0 || index === chartDays.value.length - 1;
}

async function loadUsage() {
  loading.value = true;
  try {
    stats.value = await api.getUsageStats(loadSettings().sessionsDir || undefined);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    loading.value = false;
  }
}

onMounted(loadUsage);
</script>

<template>
  <section class="page usage-page" v-loading="loading">
    <header class="page-header">
      <div class="page-title"><h1>用量统计</h1><p>汇总本机 Pi Session 的 Token、费用与模型使用情况</p></div>
      <div class="toolbar"><el-button :icon="RefreshCw" :loading="loading" @click="loadUsage">刷新统计</el-button></div>
    </header>

    <template v-if="stats">
      <div class="metric-grid">
        <article class="metric-card metric-card--violet">
          <div class="metric-icon"><ChartColumn :size="18" /></div>
          <span>累计 Tokens</span>
          <strong>{{ formatTokens(stats.totals.totalTokens) }}</strong>
          <small>{{ formatFullTokens(stats.totals.totalTokens) }} tokens</small>
        </article>
        <article class="metric-card metric-card--cyan">
          <div class="metric-icon"><Activity :size="18" /></div>
          <span>今日用量</span>
          <strong>{{ formatTokens(stats.today.totalTokens) }}</strong>
          <small>{{ stats.today.requests }} 次模型请求</small>
        </article>
        <article class="metric-card metric-card--rose">
          <div class="metric-icon"><CircleDollarSign :size="18" /></div>
          <span>累计费用</span>
          <strong>{{ formatCost(stats.totals.totalCost) }}</strong>
          <small>今日 {{ formatCost(stats.today.totalCost) }}</small>
        </article>
        <article class="metric-card metric-card--mist">
          <div class="metric-icon"><MessagesSquare :size="18" /></div>
          <span>会话与消息</span>
          <strong>{{ stats.totals.sessions }}</strong>
          <small>{{ stats.totals.messages }} 条消息 · {{ stats.totals.requests }} 次请求</small>
        </article>
      </div>

      <div v-if="hasUsage" class="usage-primary-grid">
        <div class="panel usage-chart-panel">
          <div class="panel-header">
            <div><h2>Token 趋势</h2><span class="usage-panel-note">按模型请求时间聚合</span></div>
            <el-radio-group v-model="range" size="small" class="range-control">
              <el-radio-button value="7">7 天</el-radio-button>
              <el-radio-button value="30">30 天</el-radio-button>
              <el-radio-button value="all">全部</el-radio-button>
            </el-radio-group>
          </div>
          <div class="usage-chart" :class="{ 'usage-chart--dense': chartDays.length > 45 }">
            <div v-for="(day, index) in chartDays" :key="day.date" class="usage-bar-column" :title="`${day.date} · ${formatFullTokens(day.totalTokens)} tokens · ${formatCost(day.totalCost)}`">
              <span class="usage-bar-value">{{ chartDays.length <= 14 && day.totalTokens ? formatTokens(day.totalTokens) : "" }}</span>
              <div class="usage-bar-track"><span class="usage-bar" :style="{ height: `${Math.max(3, day.totalTokens / maxDailyTokens * 100)}%` }"></span></div>
              <span class="usage-bar-label">{{ showDayLabel(index) ? dayLabel(day.date) : "" }}</span>
            </div>
          </div>
        </div>

        <div class="panel token-mix-panel">
          <div class="panel-header"><h2>Token 构成</h2><span class="panel-index">ALL TIME</span></div>
          <div class="panel-body token-mix-list">
            <div v-for="item in tokenMix" :key="item.label" class="token-mix-item">
              <div class="token-mix-head"><span><i :class="`mix-dot mix-dot--${item.tone}`"></i>{{ item.label }}</span><strong>{{ formatTokens(item.value) }}</strong></div>
              <div class="mix-track"><span :class="`mix-fill mix-fill--${item.tone}`" :style="{ width: `${stats.totals.totalTokens ? Math.max(1, item.value / stats.totals.totalTokens * 100) : 0}%` }"></span></div>
              <small>{{ formatFullTokens(item.value) }} tokens</small>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasUsage" class="usage-secondary-grid">
        <div class="panel ranking-panel">
          <div class="panel-header"><h2>模型用量</h2><span class="count-mark">{{ stats.models.length }}</span></div>
          <div class="ranking-list">
            <div v-for="(model, index) in stats.models" :key="model.name" class="ranking-row">
              <span class="ranking-index">{{ String(index + 1).padStart(2, "0") }}</span>
              <div class="ranking-main"><strong>{{ model.name }}</strong><div class="ranking-track"><span :style="{ width: `${model.totalTokens / maxModelTokens * 100}%` }"></span></div></div>
              <div class="ranking-value"><strong>{{ formatTokens(model.totalTokens) }}</strong><small>{{ model.requests }} 次 · {{ formatCost(model.totalCost) }}</small></div>
            </div>
          </div>
        </div>

        <div class="panel provider-panel">
          <div class="panel-header"><h2>Provider 分布</h2><span class="count-mark">{{ stats.providers.length }}</span></div>
          <div class="panel-body provider-list">
            <div v-for="provider in stats.providers" :key="provider.name" class="provider-usage">
              <div><strong>{{ provider.name }}</strong><small>{{ provider.requests }} 次请求</small></div>
              <div class="provider-amount"><strong>{{ formatTokens(provider.totalTokens) }}</strong><span>{{ formatCost(provider.totalCost) }}</span></div>
              <span class="provider-share" :style="{ width: `${provider.totalTokens / maxProviderTokens * 100}%` }"></span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="panel usage-empty">
        <div class="empty-state"><strong>还没有可统计的模型用量</strong><span>创建 Pi 对话后，这里会从 Session 文件自动汇总 Token 与费用。</span></div>
      </div>
    </template>
  </section>
</template>
