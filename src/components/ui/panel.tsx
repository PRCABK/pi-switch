import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** 面板：白底 + 细边框 + 小圆角，页面内容的基本容器。 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel", className)}>{children}</div>;
}

/** 面板标题栏：左侧标题、右侧操作。 */
export function PanelHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel-header", className)}>{children}</div>;
}

/** 面板正文。 */
export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel-body", className)}>{children}</div>;
}
