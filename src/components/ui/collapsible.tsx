import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/** 折叠区：默认收起，展开后显示正文。 */
export function Collapsible({ title, defaultOpen = false, className, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-t border-line", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-transparent py-2 text-left text-[11px] text-ink-2 hover:text-ink"
      >
        <span>{title}</span>
        <ChevronDown size={13} className={cn("flex-none transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}
