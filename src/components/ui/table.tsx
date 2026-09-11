import type { CSSProperties, ReactNode, ThHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface TableProps {
  children: ReactNode;
  className?: string;
}

interface CellProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "center" | "right";
  colSpan?: number;
}

const alignClass = { left: "text-left", center: "text-center", right: "text-right" } as const;

/** 表格外壳：细边框 + 小圆角，表头为浅灰底。 */
export function Table({ children, className }: TableProps) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-line bg-panel", className)}>
      <table className="w-full border-collapse text-left text-[11px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/** 数据行：最后一行不描边，鼠标悬停给出浅灰反馈。 */
export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("transition-colors hover:bg-hover [&:last-child>td]:border-b-0", className)}>
      {children}
    </tr>
  );
}

export function TH({ children, className, align = "left", style }: CellProps & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      style={style}
      className={cn(
        "h-10 border-b border-line px-3 text-[10px] font-semibold whitespace-nowrap text-ink-2",
        alignClass[align],
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, align = "left", style, colSpan }: CellProps) {
  return (
    <td
      colSpan={colSpan}
      style={style}
      className={cn("h-[42px] border-b border-line px-3 align-middle text-ink", alignClass[align], className)}
    >
      {children}
    </td>
  );
}

/** 空数据提示行，跨全部列居中显示。 */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TR className="hover:bg-transparent">
      <TD colSpan={colSpan} className="h-auto py-12 text-center text-caption text-ink-3">
        {children}
      </TD>
    </TR>
  );
}
