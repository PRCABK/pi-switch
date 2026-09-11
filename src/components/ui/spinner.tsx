import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

/** 旋转指示器。 */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-ink-3", className)} />;
}

/** 覆盖在最近祖先定位元素之上的加载遮罩，替代 v-loading 指令。 */
export function LoadingOverlay({ visible, className }: { visible: boolean; className?: string }) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 grid place-items-center bg-white/70 backdrop-blur-[3px]",
        className,
      )}
    >
      <Spinner size={20} />
    </div>
  );
}
