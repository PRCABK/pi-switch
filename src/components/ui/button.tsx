import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { IconType } from "./icon";

type ButtonVariant = "default" | "primary" | "dangerPlain" | "link" | "linkDanger";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconType;
}

const variants: Record<ButtonVariant, string> = {
  default:
    "bg-panel text-ink border border-line-default hover:bg-hover hover:border-line-strong active:bg-active",
  primary:
    "bg-accent text-inverse border border-accent hover:bg-accent-strong hover:border-accent-strong active:bg-black",
  dangerPlain:
    "bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:border-danger hover:text-inverse",
  link: "bg-transparent text-accent border-0 px-1 hover:text-accent-strong",
  linkDanger: "bg-transparent text-danger border-0 px-1 hover:text-danger/80",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-[34px] px-[14px] text-caption",
  sm: "min-h-[30px] px-[11px] text-[11px]",
};

/** 按钮：中性扁平外观，支持主/危险/文字三种变体与加载态。 */
export function Button({
  variant = "default",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 13 : 14;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-[120ms] select-none disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : Icon ? (
        <Icon size={iconSize} />
      ) : null}
      {children}
    </button>
  );
}
