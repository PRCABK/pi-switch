/** 把 IPC/命令错误统一转成可展示的文本。 */
export function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

/** 紧凑计数（1.2M / 12.3K），用于指标卡与图表。 */
export function formatTokens(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** 千分位完整计数。 */
export function formatFullTokens(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/** 会话列表用的短计数（1.2M / 12.3K / 999）。 */
export function formatShortTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/** 费用：小于 1 分时保留 4 位小数，避免显示成 $0.00。 */
export function formatCost(value: number): string {
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

/** 会话时间：月/日 时:分。 */
export function formatTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** 日期：年/月/日。 */
export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** ISO 日期（YYYY-MM-DD）→ 图表轴标签（MM/DD）。 */
export function dayLabel(value: string): string {
  return value.slice(5).replace("-", "/");
}
