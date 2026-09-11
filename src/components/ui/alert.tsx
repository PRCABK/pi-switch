import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** 信息提示条：与面板同色的低强度底色，用于展示路径与状态摘要。 */
export function Alert({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("path-alert", className)}>{children}</div>;
}
