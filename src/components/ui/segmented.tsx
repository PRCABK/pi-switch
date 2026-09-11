import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

/** 分段控件：替代 el-radio-button 组，选中项为近黑填充。 */
export function Segmented<T extends string>({ value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div className={cn("inline-flex", className)} role="group">
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[28px] border border-line-default px-3 text-[11px] transition-colors",
              index === 0 && "rounded-l-md",
              index === options.length - 1 && "rounded-r-md",
              index > 0 && "-ml-px",
              active
                ? "relative z-[1] border-accent bg-accent text-inverse"
                : "bg-panel text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
