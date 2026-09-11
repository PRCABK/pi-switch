import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

const fieldBase =
  "w-full rounded-md bg-panel text-caption text-ink shadow-[inset_0_0_0_1px_var(--color-line-default)] transition-shadow outline-none placeholder:text-ink-3 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:focus-ring";

/** 单行输入框：以内阴影描边代替 border，聚焦时给近黑聚焦环。 */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "min-h-[34px] px-3", className)} {...rest} />;
}

/** 多行输入框。 */
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "px-3 py-2 leading-[1.6]", className)} {...rest} />;
}

/** 下拉选择：保留原生控件以获得系统一致的交互与键盘行为。 */
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "min-h-[34px] cursor-pointer px-3", className)} {...rest} />;
}

/** 密码输入框：带显示/隐藏切换。 */
export function PasswordInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={cn(fieldBase, "min-h-[34px] px-3 pr-9", className)}
      />
      <button
        type="button"
        aria-label={visible ? "隐藏" : "显示"}
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-1.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
      >
        {visible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

interface FieldProps {
  label?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** 表单字段：标签在上、控件在下，替代 el-form-item。 */
export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <div className={cn("mb-[18px]", className)}>
      {label ? <div className="pb-1.5 text-caption leading-[1.3] font-semibold text-ink">{label}</div> : null}
      {children}
      {hint ? <div className="mt-1.5 text-micro text-ink-3">{hint}</div> : null}
    </div>
  );
}
