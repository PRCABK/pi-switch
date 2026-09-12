import { useEffect, useMemo, useState } from "react";
import { Activity, ChartColumn, CircleDollarSign, MessagesSquare, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { UsageStats } from "../types";
import { dayLabel, errorText, formatCost, formatFullTokens, formatTokens } from "../lib/format";
import { cn } from "../lib/utils";
import { Page } from "../components/ui/page";
import { Panel, PanelBody, PanelHeader } from "../components/ui/panel";
import { Button } from "../components/ui/button";
import { Segmented } from "../components/ui/segmented";
import { toast } from "../components/ui/feedback";

type RangeValue = "7" | "30" | "all";

interface ChartDay {
  date: string;
  totalTokens: number;
  totalCost: number;
  requests: number;
  sessions: number;
}

interface ChartPoint {
  x: number;
  y: number;
  day: ChartDay;
  index: number;
}

const TONE_CLASSES = {
  rose: { dot: "bg-data-rose", fill: "bg-data-rose", seg: "bg-data-rose" },
  violet: { dot: "bg-data-violet", fill: "bg-data-violet", seg: "bg-data-violet" },
  cyan: { dot: "bg-data-cyan", fill: "bg-data-cyan", seg: "bg-data-cyan" },
  mist: { dot: "bg-data-mist", fill: "bg-data-mist", seg: "bg-data-mist" },
} as const;

type Tone = keyof typeof TONE_CLASSES;

const EMPTY_DAY: ChartDay = { date: "", totalTokens: 0, totalCost: 0, requests: 0, sessions: 0 };

function calendarDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(days: number, source: UsageStats["daily"]): ChartDay[] {
  const byDate = new Map(source.map((day) => [day.date, day]));
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - (days - index - 1));
    const key = calendarDateKey(date);
    return byDate.get(key) ?? { date: key, totalTokens: 0, totalCost: 0, requests: 0, sessions: 0 };
  });
}

/** 平滑三次贝塞尔路径：用相邻点斜率推导控制点，避免折线感。 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlOne = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const controlTwo = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };
    path += ` C ${controlOne.x.toFixed(2)} ${controlOne.y.toFixed(2)}, ${controlTwo.x.toFixed(2)} ${controlTwo.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

export default function UsageView() {
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeValue>("7");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [activeChartDay, setActiveChartDay] = useState<number | null>(null);
  const [chartNode, setChartNode] = useState<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  async function loadUsage() {
    setLoading(true);
    try {
      setStats(await api.getUsageStats(loadSettings().sessionsDir || undefined));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsage();
  }, []);

  // 图表坐标系直接用像素测量值：viewBox 与实际尺寸一致，拉伸比例恒为 1，
  // 圆点与文字不会被非等比缩放压变形。
  // 图表容器要等 stats 到达后才挂载，因此用回调 ref 驱动观察器，而不是在挂载 effect 里取 ref。
  useEffect(() => {
    if (!chartNode) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setChartSize({ width: rect.width, height: rect.height });
    });
    observer.observe(chartNode);
    return () => observer.disconnect();
  }, [chartNode]);

  const chartDays = useMemo(() => {
    const days = stats?.daily ?? [];
    return range === "all" ? days : buildCalendarDays(Number(range), days);
  }, [range, stats]);

  const maxDailyTokens = useMemo(
    () => Math.max(1, ...chartDays.map((day) => day.totalTokens)),
    [chartDays],
  );

  const lineChart = useMemo(() => {
    const width = chartSize.width;
    const height = chartSize.height;
    const top = 20;
    const labelBand = 22;
    const baseline = Math.max(top + 1, height - labelBand);
    const usableHeight = baseline - top;
    if (width < 2 || height < 2) {
      const points: ChartPoint[] = [];
      return { width: 1, height: 1, baseline, points, linePath: "", areaPath: "", gridLines: [] };
    }
    const horizontalPadding = 10;
    const count = chartDays.length;
    const points = chartDays.map((day, index) => {
      const x =
        count === 1 ? width / 2 : horizontalPadding + index * ((width - horizontalPadding * 2) / (count - 1));
      const y = baseline - (day.totalTokens / maxDailyTokens) * usableHeight;
      return { x, y, day, index };
    });
    const linePath = smoothPath(points);
    const areaPath =
      linePath && points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`
        : "";
    return {
      width,
      height,
      baseline,
      points,
      linePath,
      areaPath,
      // 只保留最大值与半高两条参考线，给静止状态一个量级参照。
      gridLines: [
        { value: maxDailyTokens, y: top },
        { value: maxDailyTokens / 2, y: baseline - usableHeight / 2 },
      ],
    };
  }, [chartDays, maxDailyTokens, chartSize]);

  const maxModelTokens = useMemo(
    () => Math.max(1, ...(stats?.models.map((model) => model.totalTokens) ?? [])),
    [stats],
  );
  const maxProviderTokens = useMemo(
    () => Math.max(1, ...(stats?.providers.map((provider) => provider.totalTokens) ?? [])),
    [stats],
  );
  const hasUsage = Boolean(stats?.totals.requests);

  // 区间趋势汇总：总量 / 日均 / 峰值 / 费用
  const rangeSummary = useMemo(() => {
    const totalTokens = chartDays.reduce((sum, day) => sum + day.totalTokens, 0);
    const totalCost = chartDays.reduce((sum, day) => sum + day.totalCost, 0);
    const peak = chartDays.reduce(
      (max, day) => (day.totalTokens > max.totalTokens ? day : max),
      chartDays[0] ?? EMPTY_DAY,
    );
    const avg = chartDays.length ? totalTokens / chartDays.length : 0;
    return { totalTokens, totalCost, peak, avg, days: chartDays.length };
  }, [chartDays]);

  // 区间环比：用区间最后一天 vs 前一天（单日环比），无数据则不显示
  const dayDelta = useMemo(() => {
    if (chartDays.length < 2) return null;
    const last = chartDays[chartDays.length - 1].totalTokens;
    const prev = chartDays[chartDays.length - 2].totalTokens;
    if (!prev) return null;
    return { pct: ((last - prev) / prev) * 100, up: last >= prev };
  }, [chartDays]);

  const tokenMix = useMemo(() => {
    const totals = stats?.totals;
    if (!totals) return [];
    const all = totals.totalTokens || 1;
    return [
      { label: "输入", value: totals.inputTokens, tone: "violet" as Tone, pct: (totals.inputTokens / all) * 100 },
      { label: "输出", value: totals.outputTokens, tone: "cyan" as Tone, pct: (totals.outputTokens / all) * 100 },
      { label: "缓存读取", value: totals.cacheReadTokens, tone: "mist" as Tone, pct: (totals.cacheReadTokens / all) * 100 },
      { label: "缓存写入", value: totals.cacheWriteTokens, tone: "rose" as Tone, pct: (totals.cacheWriteTokens / all) * 100 },
    ];
  }, [stats]);

  function showDayLabel(index: number): boolean {
    return chartDays.length <= 10 || index % 5 === 0 || index === chartDays.length - 1;
  }

  const activePoint = activeChartDay === null ? null : lineChart.points[activeChartDay];
  const singleDay = chartDays.length === 1 ? chartDays[0] : null;

  return (
    <Page
      title="用量统计"
      subtitle="汇总本机 Pi Session 的 Token、费用与模型使用情况"
      loading={loading}
      actions={
        <Button icon={RefreshCw} loading={loading} onClick={() => void loadUsage()}>
          刷新统计
        </Button>
      }
    >
      {stats ? (
        <>
          <div className="mb-4 grid grid-cols-4 gap-3.5 max-[1250px]:grid-cols-2 max-[600px]:grid-cols-1">
            <article className="relative min-h-[142px] min-w-0 overflow-hidden rounded-lg border border-line bg-panel px-5 py-[18px] shadow-sm transition-colors hover:border-line-strong">
              <div className="absolute top-[15px] right-4 grid h-7 w-7 place-items-center rounded-sm border border-line bg-panel text-ink-2">
                <ChartColumn size={16} />
              </div>
              <span className="block pr-[34px] text-micro font-semibold text-ink-2">累计 Tokens</span>
              <strong className="mt-[18px] block truncate text-[clamp(26px,2.2vw,32px)] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">
                {formatTokens(stats.totals.totalTokens)}
              </strong>
              <small className="mt-[9px] block truncate text-[11px] text-ink-3">
                {formatFullTokens(stats.totals.totalTokens)} tokens
              </small>
            </article>

            <article className="relative min-h-[142px] min-w-0 overflow-hidden rounded-lg border border-accent/16 bg-accent-soft px-5 py-[18px] shadow-sm transition-colors hover:border-line-strong">
              <div className="absolute top-[15px] right-4 grid h-7 w-7 place-items-center rounded-sm border border-accent/20 bg-panel text-accent">
                <Activity size={16} />
              </div>
              <span className="block pr-[34px] text-micro font-semibold text-ink-2">今日用量</span>
              <strong className="mt-[18px] block truncate text-[clamp(26px,2.2vw,32px)] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">
                {formatTokens(stats.today.totalTokens)}
              </strong>
              <small className="mt-[9px] block truncate text-[11px] text-ink-3">
                {stats.today.requests} 次请求 · {formatCost(stats.today.totalCost)}
              </small>
            </article>

            <article className="relative min-h-[142px] min-w-0 overflow-hidden rounded-lg border border-line bg-panel px-5 py-[18px] shadow-sm transition-colors hover:border-line-strong">
              <div className="absolute top-[15px] right-4 grid h-7 w-7 place-items-center rounded-sm border border-line bg-panel text-ink-2">
                <CircleDollarSign size={16} />
              </div>
              <span className="block pr-[34px] text-micro font-semibold text-ink-2">累计费用</span>
              <strong className="mt-[18px] block truncate text-[clamp(26px,2.2vw,32px)] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">
                {formatCost(stats.totals.totalCost)}
              </strong>
              <small className="mt-[9px] block truncate text-[11px] text-ink-3">
                今日 {formatCost(stats.today.totalCost)}
              </small>
            </article>

            <article className="relative min-h-[142px] min-w-0 overflow-hidden rounded-lg border border-line bg-panel px-5 py-[18px] shadow-sm transition-colors hover:border-line-strong">
              <div className="absolute top-[15px] right-4 grid h-7 w-7 place-items-center rounded-sm border border-line bg-panel text-ink-2">
                <MessagesSquare size={16} />
              </div>
              <span className="block pr-[34px] text-micro font-semibold text-ink-2">会话与消息</span>
              <strong className="mt-[18px] block truncate text-[clamp(26px,2.2vw,32px)] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">
                {stats.totals.sessions}
              </strong>
              <small className="mt-[9px] block truncate text-[11px] text-ink-3">
                {stats.totals.messages} 条消息 · {stats.totals.requests} 次请求
              </small>
            </article>
          </div>

          <div className="mb-4 grid grid-cols-[minmax(0,1.8fr)_minmax(280px,0.7fr)] gap-4 max-[900px]:grid-cols-1">
            <Panel className="min-w-0">
              <PanelHeader className="max-[600px]:flex-col max-[600px]:items-start">
                <div className="flex min-w-0 items-center gap-4">
                  <h2 className="text-body">Token 趋势</h2>
                  <div className="flex items-center gap-3">
                    <span className="flex items-baseline gap-[5px] text-ink-3">
                      <i className="text-[10px] font-semibold not-italic tracking-[0.04em]">区间总量</i>
                      <b className="text-caption font-[650] tabular-nums text-ink">
                        {formatTokens(rangeSummary.totalTokens)}
                      </b>
                    </span>
                    <span className="h-3 w-px bg-line-default" />
                    <span className="flex items-baseline gap-[5px] text-ink-3">
                      <i className="text-[10px] font-semibold not-italic tracking-[0.04em]">日均</i>
                      <b className="text-caption font-[650] tabular-nums text-ink">{formatTokens(rangeSummary.avg)}</b>
                    </span>
                    {dayDelta ? (
                      <>
                        <span className="h-3 w-px bg-line-default" />
                        <span className="flex items-baseline gap-[5px] text-ink-3">
                          <i className="text-[10px] font-semibold not-italic tracking-[0.04em]">环比</i>
                          <b
                            className={cn(
                              "flex items-center text-caption font-[650] tabular-nums",
                              dayDelta.up ? "text-danger" : "text-success",
                            )}
                          >
                            {dayDelta.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(dayDelta.pct).toFixed(0)}%
                          </b>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Segmented
                  value={range}
                  onChange={setRange}
                  className="max-[600px]:w-full"
                  options={[
                    { value: "7", label: "7 天" },
                    { value: "30", label: "30 天" },
                    { value: "all", label: "全部" },
                  ]}
                />
              </PanelHeader>

              <div
                className="relative h-[260px] max-[600px]:h-[230px]"
                onMouseLeave={() => setActiveChartDay(null)}
              >
                <div ref={setChartNode} className="absolute inset-x-[18px] top-4 bottom-1 max-[600px]:inset-x-3">
                  <svg
                    className="block h-full w-full overflow-visible"
                    viewBox={`0 0 ${lineChart.width} ${lineChart.height}`}
                    role="img"
                    aria-label="每日 Token 使用趋势"
                  >
                    <defs>
                      <linearGradient id="usage-chart-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="text-accent" stopColor="currentColor" stopOpacity="0.26" />
                        <stop offset="70%" className="text-accent" stopColor="currentColor" stopOpacity="0.06" />
                        <stop offset="100%" className="text-accent" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {lineChart.gridLines.map((grid) => (
                      <g key={grid.value}>
                        <line
                          className="stroke-line-default stroke-1 opacity-60"
                          x1="0"
                          y1={grid.y}
                          x2={lineChart.width}
                          y2={grid.y}
                        />
                        <text
                          className="fill-ink-3 text-[10px] tabular-nums"
                          x="0"
                          y={grid.y - 5}
                          textAnchor="start"
                        >
                          {formatTokens(grid.value)}
                        </text>
                      </g>
                    ))}
                    <line
                      className="stroke-line-default stroke-1"
                      x1="0"
                      y1={lineChart.baseline}
                      x2={lineChart.width}
                      y2={lineChart.baseline}
                    />
                    {lineChart.areaPath ? <path className="fill-[url(#usage-chart-fill)]" d={lineChart.areaPath} /> : null}
                    {lineChart.linePath ? (
                      <path
                        pathLength={1}
                        className="animate-line-enter fill-none stroke-accent stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                        d={lineChart.linePath}
                      />
                    ) : null}
                    {lineChart.points.map((point) => {
                      const active = activeChartDay === point.index;
                      const isPeak =
                        point.day.totalTokens === rangeSummary.peak.totalTokens && point.day.totalTokens > 0;
                      return (
                        <g key={point.day.date} onMouseEnter={() => setActiveChartDay(point.index)}>
                          {active ? (
                            <line
                              className="stroke-line-strong stroke-1 [stroke-dasharray:2_3]"
                              x1={point.x}
                              x2={point.x}
                              y1={point.y}
                              y2={lineChart.baseline}
                            />
                          ) : null}
                          <circle className="cursor-crosshair fill-transparent" cx={point.x} cy={point.y} r="18" />
                          {active || isPeak || singleDay ? (
                            <circle className="fill-accent stroke-panel" cx={point.x} cy={point.y} r={active ? 5 : 4} />
                          ) : null}
                          {showDayLabel(point.index) ? (
                            <text
                              className="fill-ink-3 text-[11px] tabular-nums"
                              x={point.x}
                              y={lineChart.height - 5}
                              textAnchor="middle"
                            >
                              {dayLabel(point.day.date)}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                </svg>

                {activePoint ? (
                  <div
                    className="pointer-events-none absolute top-[11px] z-[1] grid min-w-[122px] -translate-x-1/2 gap-0.5 rounded-sm border border-line-default bg-panel/94 px-2.5 py-[7px] shadow-[0_6px_18px_rgb(24_24_27/10%)] backdrop-blur-[8px]"
                    style={{ left: `${activePoint.x}px` }}
                  >
                    <strong className="text-caption tabular-nums text-ink">
                      {formatTokens(activePoint.day.totalTokens)}
                    </strong>
                    <span className="text-[11px] whitespace-nowrap text-ink-3">
                      {activePoint.day.date} · {activePoint.day.requests} 次请求
                    </span>
                  </div>
                ) : null}

                {singleDay ? (
                  <div className="absolute top-[30px] left-1/2 grid -translate-x-1/2 gap-[3px] text-center">
                    <strong className="text-[22px] font-[680] tabular-nums text-ink">
                      {formatTokens(singleDay.totalTokens)}
                    </strong>
                    <span className="text-[11px] whitespace-nowrap text-ink-3">{singleDay.date} · 当日用量</span>
                  </div>
                ) : null}
                </div>
              </div>

              <div className="flex justify-between border-t border-line bg-muted px-[18px] pt-2.5 pb-3.5 text-[10px]">
                <span className="font-mono text-ink-2">
                  峰值 {formatTokens(rangeSummary.peak.totalTokens)} ·{" "}
                  {rangeSummary.peak.totalTokens ? rangeSummary.peak.date : "-"}
                </span>
                <span className="text-[10px] text-ink-2">
                  共 {rangeSummary.days} 天 · {chartDays.reduce((sum, day) => sum + day.requests, 0)} 次请求
                </span>
              </div>
            </Panel>

            <Panel>
              <PanelHeader>
                <h2>Token 构成</h2>
                <span className="panel-index">ALL TIME</span>
              </PanelHeader>
              <PanelBody>
                <div className="mb-[18px] flex h-2 overflow-hidden rounded-pill bg-active" aria-hidden="true">
                  {tokenMix.map((item) => (
                    <span
                      key={item.label}
                      className={cn("h-full min-w-0", TONE_CLASSES[item.tone].seg)}
                      style={{ width: `${item.pct}%` }}
                    />
                  ))}
                </div>
                <div className="grid gap-3.5">
                  {tokenMix.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <div className="mb-1.5 flex items-center justify-between gap-2.5 text-[11px] text-ink">
                        <span className="flex items-center gap-2">
                          <i className={cn("inline-block h-[7px] w-[7px] rounded-xs", TONE_CLASSES[item.tone].dot)} />
                          {item.label}
                        </span>
                        <strong className="tabular-nums">{formatTokens(item.value)}</strong>
                      </div>
                      <div className="h-[5px] overflow-hidden rounded-pill bg-active">
                        <span
                          className={cn("block h-full min-w-[2px] rounded-[inherit]", TONE_CLASSES[item.tone].fill)}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                      <small className="mt-[5px] block text-[9px] tabular-nums text-ink-3">
                        {formatFullTokens(item.value)} tokens · {item.pct.toFixed(1)}%
                      </small>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          </div>

          {hasUsage ? (
            <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] gap-4 max-[900px]:grid-cols-1">
              <Panel>
                <PanelHeader>
                  <h2>模型用量</h2>
                  <span className="count-mark">{stats.models.length}</span>
                </PanelHeader>
                <PanelBody className="grid max-h-[560px] gap-2 overflow-auto">
                  {stats.models.map((model) => (
                    <div
                      key={model.name}
                      className="relative flex min-h-[58px] items-center justify-between gap-3 overflow-hidden rounded-md border border-line bg-panel px-3.5 py-[11px]"
                    >
                      <div className="relative z-[1] min-w-0">
                        <strong className="block truncate text-[11px] font-semibold text-ink">{model.name}</strong>
                        <small className="mt-[3px] block text-[9px] tabular-nums text-ink-3">
                          {model.requests} 次请求
                        </small>
                      </div>
                      <div className="relative z-[1] text-right">
                        <strong className="block text-[11px] tabular-nums text-ink">
                          {formatTokens(model.totalTokens)}
                        </strong>
                        <span className="mt-[3px] block text-[9px] tabular-nums text-ink-3">
                          {formatCost(model.totalCost)}
                        </span>
                      </div>
                      <span
                        className="absolute bottom-0 left-0 h-0.5 rounded-r-pill bg-accent"
                        style={{ width: `${(model.totalTokens / maxModelTokens) * 100}%` }}
                      />
                    </div>
                  ))}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader>
                  <h2>Provider 分布</h2>
                  <span className="count-mark">{stats.providers.length}</span>
                </PanelHeader>
                <PanelBody className="grid max-h-[560px] gap-2 overflow-auto">
                  {stats.providers.map((provider) => (
                    <div
                      key={provider.name}
                      className="relative flex min-h-[58px] items-center justify-between gap-3 overflow-hidden rounded-md border border-line bg-panel px-3.5 py-[11px]"
                    >
                      <div className="relative z-[1]">
                        <strong className="block text-[11px] font-semibold text-ink">{provider.name}</strong>
                        <small className="mt-[3px] block text-[9px] tabular-nums text-ink-3">
                          {provider.requests} 次请求
                        </small>
                      </div>
                      <div className="relative z-[1] text-right">
                        <strong className="block text-[11px] tabular-nums text-ink">
                          {formatTokens(provider.totalTokens)}
                        </strong>
                        <span className="mt-[3px] block text-[9px] tabular-nums text-ink-3">
                          {formatCost(provider.totalCost)}
                        </span>
                      </div>
                      <span
                        className="absolute bottom-0 left-0 h-0.5 rounded-r-pill bg-accent"
                        style={{ width: `${(provider.totalTokens / maxProviderTokens) * 100}%` }}
                      />
                    </div>
                  ))}
                </PanelBody>
              </Panel>
            </div>
          ) : (
            <Panel className="grid min-h-[300px] place-items-center">
              <div className="empty-state flex flex-col items-center justify-center">
                <strong className="text-control text-ink">还没有可统计的模型用量</strong>
                <span className="mt-1.5 block">创建 Pi 对话后，这里会从 Session 文件自动汇总 Token 与费用。</span>
              </div>
            </Panel>
          )}
        </>
      ) : null}
    </Page>
  );
}
