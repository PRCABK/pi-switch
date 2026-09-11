import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** 开关：开启态为近黑填充。 */
export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative inline-flex h-5 w-9 flex-none cursor-pointer items-center rounded-pill border-0 bg-line-strong transition-colors",
        "data-[state=checked]:bg-accent disabled:cursor-default disabled:opacity-45",
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-panel shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
