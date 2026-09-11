import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  width?: number | string;
  footer?: ReactNode;
  closeOnOutsideClick?: boolean;
  children: ReactNode;
}

/** 模态对话框：遮罩模糊 + 描边卡片，标题与页脚固定、正文滚动。 */
export function Dialog({ open, onOpenChange, title, width = 560, footer, closeOnOutsideClick = true, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-[rgba(9,9,11,0.4)] backdrop-blur-[4px]" />
        <DialogPrimitive.Content
          style={{ width }}
          onInteractOutside={(event) => {
            if (!closeOnOutsideClick) event.preventDefault();
          }}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh_-_80px)] -translate-x-1/2 -translate-y-1/2 animate-content-in overflow-hidden rounded-xl border border-line bg-panel shadow-modal",
            "max-w-[calc(100vw_-_24px)]",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 pt-[18px] pb-[15px]">
            <DialogPrimitive.Title className="text-title font-[650] text-ink">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="关闭"
              className="-mt-0.5 -mr-1 grid h-[30px] w-[30px] place-items-center rounded-sm text-ink-3 transition-colors hover:bg-hover hover:text-ink"
            >
              <X size={15} />
            </DialogPrimitive.Close>
          </div>
          <div className="max-h-[calc(100vh_-_230px)] overflow-auto p-5">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-line px-5 pt-[13px] pb-[17px]">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
