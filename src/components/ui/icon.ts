import type { ReactNode } from "react";

/** lucide-react 图标的结构化类型：只声明本项目用到的属性。 */
export type IconType = (props: {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}) => ReactNode;
