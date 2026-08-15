<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, ChartColumn, CircleDollarSign, MessagesSquare, RefreshCw, TrendingDown, TrendingUp } from "@lucide/vue";
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

// 区间趋势汇总：总量 / 日均 / 峰值 / 费用
const rangeSummary = computed(() => {
  const days = chartDays.value;
  const totalTokens = days.reduce((sum, day) => sum + day.totalTokens, 0);
  const totalCost = days.reduce((sum, day) => sum + day.totalCost, 0);
  const peak = days.reduce((max, day) => (day.totalTokens > max.totalTokens ? day : max), days[0] ?? { date: "", totalTokens: 0, totalCost: 0, requests: 0, sessions: 0 });
  const avg = days.length ? totalTokens / days.length : 0;
  return { totalTokens, totalCost, peak, avg, days: days.length };
});

// 区间环比：用区间最后一天 vs 前一天（单日环比），无数据则不显示
const dayDelta = computed(() => {
  const days = chartDays.value;
  if (days.length < 2) return null;
  const last = days[days.length - 1].totalTokens;
  const prev = days[days.length - 2].totalTokens;
  if (!prev) return null;
  return { pct: ((last - prev) / prev) * 100, up: last >= prev };
});

const tokenMix = computed(() => {
  const totals = stats.value?.totals;
  if (!totals) return [];
  const all = totals.totalTokens || 1;
  return [
    { label: "输入", value: totals.inputTokens, tone: "violet", pct: (totals.inputTokens / all) * 100 },
    { label: "输出", value: totals.outputTokens, tone: "cyan", pct: (totals.outputTokens / all) * 100 },
    { label: "缓存读取", value: totals.cacheReadTokens, tone: "mist", pct: (totals.cacheReadTokens / all) * 100 },
    { label: "缓存写入", value: totals.cacheWriteTokens, tone: "rose", pct: (totals.cacheWriteTokens / all) * 100 },
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
        <article class="metric-card">
          <div class="metric-icon"><ChartColumn :size="16" /></div>
          <span>累计 Tokens</span>
          <strong>{{ formatTokens(stats.totals.totalTokens) }}</strong>
          <small>{{ formatFullTokens(stats.totals.totalTokens) }} tokens</small>
        </article>
        <article class="metric-card metric-card--accent">
          <div class="metric-icon"><Activity :size="16" /></div>
          <span>今日用量</span>
          <strong>{{ formatTokens(stats.today.totalTokens) }}</strong>
          <small>{{ stats.today.requests }} 次请求 · {{ formatCost(stats.today.totalCost) }}</small>
        </article>
        <article class="metric-card">
          <div class="metric-icon"><CircleDollarSign :size="16" /></div>
          <span>累计费用</span>
          <strong>{{ formatCost(stats.totals.totalCost) }}</strong>
          <small>今日 {{ formatCost(stats.today.totalCost) }}</small>
        </article>
        <article class="metric-card">
          <div class="metric-icon"><MessagesSquare :size="16" /></div>
          <span>会话与消息</span>
          <strong>{{ stats.totals.sessions }}</strong>
          <small>{{ stats.totals.messages }} 条消息 · {{ stats.totals.requests }} 次请求</small>
        </article>
      </div>

      <div v-if="hasUsage" class="usage-primary-grid">
        <div class="panel usage-chart-panel">
          <div class="panel-header">
            <div class="usage-chart-title">
              <h2>Token 趋势</h2>
              <div class="usage-chart-meta">
                <span class="usage-meta-item"><i class="usage-meta-label">区间总量</i><b>{{ formatTokens(rangeSummary.totalTokens) }}</b></span>
                <span class="usage-meta-divider"></span>
                <span class="usage-meta-item"><i class="usage-meta-label">日均</i><b>{{ formatTokens(rangeSummary.avg) }}</b></span>
                <span class="usage-meta-divider"></span>
                <span class="usage-meta-item" v-if="dayDelta" :class="dayDelta.up ? 'is-up' : 'is-down'"><i class="usage-meta-label">环比</i><b><component :is="dayDelta.up ? TrendingUp : TrendingDown" :size="11" />{{ Math.abs(dayDelta.pct).toFixed(0) }}%</b></span>
              </div>
            </div>
            <el-radio-group v-model="range" size="small" class="range-control">
              <el-radio-button value="7">7 天</el-radio-button>
              <el-radio-button value="30">30 天</el-radio-button>
              <el-radio-button value="all">全部</el-radio-button>
            </el-radio-group>
          </div>
          <div class="usage-chart" :class="{ 'usage-chart--dense': chartDays.length > 45 }">
            <div v-for="(day, index) in chartDays" :key="day.date" class="usage-bar-column" :class="{ 'is-peak': day.totalTokens === rangeSummary.peak.totalTokens && day.totalTokens > 0 }" :title="`${day.date} · ${formatFullTokens(day.totalTokens)} tokens · ${formatCost(day.totalCost)}`">
              <span class="usage-bar-value">{{ chartDays.length <= 14 && day.totalTokens ? formatTokens(day.totalTokens) : "" }}</span>
              <div class="usage-bar-track"><span class="usage-bar" :style="{ height: `${Math.max(3, day.totalTokens / maxDailyTokens * 100)}%` }"></span></div>
              <span class="usage-bar-label">{{ showDayLabel(index) ? dayLabel(day.date) : "" }}</span>
            </div>
          </div>
          <div class="usage-chart-footer">
            <span class="code">峰值 {{ formatTokens(rangeSummary.peak.totalTokens) }} · {{ rangeSummary.peak.date || "-" }}</span>
            <span class="muted">共 {{ rangeSummary.days }} 天 · {{ chartDays.reduce((s, d) => s + d.requests, 0) }} 次请求</span>
          </div>
        </div>

        <div class="panel token-mix-panel">
          <div class="panel-header"><h2>Token 构成</h2><span class="panel-index">ALL TIME</span></div>
          <div class="panel-body">
            <div class="mix-stack" aria-hidden="true">
              <span v-for="item in tokenMix" :key="item.label" :class="`mix-stack-seg mix-stack-seg--${item.tone}`" :style="{ width: `${item.pct}%` }"></span>
            </div>
            <div class="token-mix-list">
              <div v-for="item in tokenMix" :key="item.label" class="token-mix-item">
                <div class="token-mix-head"><span><i :class="`mix-dot mix-dot--${item.tone}`"></i>{{ item.label }}</span><strong>{{ formatTokens(item.value) }}</strong></div>
                <div class="mix-track"><span :class="`mix-fill mix-fill--${item.tone}`" :style="{ width: `${item.pct}%` }"></span></div>
                <small>{{ formatFullTokens(item.value) }} tokens · {{ item.pct.toFixed(1) }}%</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasUsage" class="usage-secondary-grid">
        <div class="panel ranking-panel">
          <div class="panel-header"><h2>模型用量</h2><span class="count-mark">{{ stats.models.length }}</span></div>
          <div class="ranking-list">
            <div v-for="(model, index) in stats.models" :key="model.name" class="ranking-row" :class="{ 'is-top': index === 0 && stats.models.length > 1 }">
              <span class="ranking-index" :class="{ 'ranking-index--top': index < 3 }">{{ String(index + 1).padStart(2, "0") }}</span>
              <div class="ranking-main">
                <strong>{{ model.name }}</strong>
                <div class="ranking-track"><span :style="{ width: `${model.totalTokens / maxModelTokens * 100}%` }"></span></div>
              </div>
              <div class="ranking-value"><strong>{{ formatTokens(model.totalTokens) }}</strong><small>{{ model.requests }} 次 · {{ formatCost(model.totalCost) }}</small></div>
            </div>
          </div>
        </div>

        <div class="panel provider-panel">
          <div class="panel-header"><h2>Provider 分布</h2><span class="count-mark">{{ stats.providers.length }}</span></div>
          <div class="panel-body provider-list">
            <div v-for="provider in stats.providers" :key="provider.name" class="provider-usage">
              <div class="provider-info"><strong>{{ provider.name }}</strong><small>{{ provider.requests }} 次请求</small></div>
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
