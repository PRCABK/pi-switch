import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DescriptionItem {
  label: string;
  children: ReactNode;
}

interface DescriptionsProps {
  items: DescriptionItem[];
  column?: 1 | 2;
  className?: string;
}

/** 键值对表格：label 浅灰底、value 白底，整体细边框小圆角。 */
export function Descriptions({ items, column = 1, className }: DescriptionsProps) {
  const lastRowStart = items.length - (items.length % column === 0 ? column : items.length % column);

  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-md border border-line",
        column === 2
          ? "grid-cols-[minmax(110px,auto)_minmax(0,1fr)_minmax(110px,auto)_minmax(0,1fr)]"
          : "grid-cols-[minmax(140px,auto)_minmax(0,1fr)]",
        className,
      )}
    >
      {items.map((item, index) => {
        const isLastRow = index >= lastRowStart;
        const isRightEdge = column === 2 ? index % 2 === 1 : true;
        return (
          <Fragment key={item.label}>
            <div
              className={cn(
                "border-r border-b border-line bg-muted px-3 py-2.5 text-[11px] font-semibold text-ink-2",
                isLastRow && "border-b-0",
              )}
            >
              {item.label}
            </div>
            <div
              className={cn(
                "border-b border-line bg-panel px-3 py-2.5 text-[11px] text-ink",
                !isRightEdge && "border-r",
                isLastRow && "border-b-0",
              )}
            >
              {item.children}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
