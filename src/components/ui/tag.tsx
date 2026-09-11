import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface TagProps {
  children: ReactNode;
  tone?: "default" | "success";
  className?: string;
}

/** 标签：低对比度小胶囊，用于状态与类型标注。 */
export function Tag({ children, tone = "default", className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] flex-none items-center rounded-sm border px-2 text-[10px]",
        tone === "success"
          ? "border-success/26 bg-success-soft text-success"
          : "border-line-default bg-muted text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
