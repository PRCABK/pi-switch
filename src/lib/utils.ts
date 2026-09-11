import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 自定义字号令牌不在 tailwind-merge 默认的字号识别范围内，必须显式登记：
// 否则 text-caption 会被归入文字颜色组，与 text-ink / text-inverse 相互覆盖。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "caption", "control", "body", "title", "brand", "heading"] }],
    },
  },
});

/** 合并条件类名并消解 Tailwind 工具类冲突。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
