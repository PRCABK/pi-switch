import type { ReactNode } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

/** 复选框：选中态为近黑填充，可单独使用或作为带文字的行内选项。 */
export function Checkbox({ checked, onCheckedChange, disabled, className, children }: CheckboxProps) {
  const box = (
    <CheckboxPrimitive.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      className={cn(
        "grid h-[15px] w-[15px] flex-none place-items-center rounded-xs border border-line-strong bg-panel transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-45",
        !children && className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check size={11} strokeWidth={3} className="text-inverse" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!children) return box;

  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-caption text-ink-2 select-none", className)}>
      {box}
      <span>{children}</span>
    </label>
  );
}
