import type { ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";
import type { IconType } from "./icon";

interface DropdownItemProps {
  icon?: IconType;
  danger?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}

/** 下拉面板容器：用于把触发按钮与菜单项组合起来。 */
export function Dropdown({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={5}
          className="z-50 min-w-[150px] animate-content-in overflow-hidden rounded-md border border-line bg-popover p-1 shadow-popover"
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/** 下拉菜单项：可带图标，危险项使用状态红。 */
export function DropdownItem({ icon: Icon, danger = false, onSelect, children }: DropdownItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        "flex min-h-[32px] cursor-default items-center gap-2 rounded-sm px-2.5 text-caption outline-none select-none",
        danger ? "text-danger data-[highlighted]:bg-danger-soft" : "text-ink data-[highlighted]:bg-hover",
      )}
    >
      {Icon ? <Icon size={14} className={danger ? "text-danger" : "text-ink-3"} /> : null}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

/** 菜单分隔线。 */
export function DropdownSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-line" />;
}
