import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { LoadingOverlay } from "./spinner";

interface PageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

/** 页面外壳：统一的标题区、工具条与整页加载遮罩。 */
export function Page({ title, subtitle, actions, loading = false, className, children }: PageProps) {
  return (
    <section className={cn("page animate-page-in", className)}>
      <LoadingOverlay visible={loading} />
      <header className="page-header">
        <div className="page-title">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="toolbar">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
