import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

type DialogResult = string | boolean | null;

interface DialogRequest {
  title: string;
  message: ReactNode;
  confirmText: string;
  cancelText: string;
  kind: "confirm" | "prompt";
  defaultValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | null;
}

interface ActiveRequest extends DialogRequest {
  resolve: (result: DialogResult) => void;
}

const TOAST_DURATION: Record<ToastKind, number> = {
  success: 3200,
  error: 5200,
  info: 3200,
  warning: 4000,
};

const TOAST_ICON: Record<ToastKind, { icon: typeof Info; tone: string }> = {
  success: { icon: CircleCheck, tone: "text-success" },
  error: { icon: CircleAlert, tone: "text-danger" },
  info: { icon: Info, tone: "text-info" },
  warning: { icon: TriangleAlert, tone: "text-warning" },
};

let toastSeq = 0;
let toasts: ToastItem[] = [];
const toastSubscribers = new Set<(items: ToastItem[]) => void>();

function emitToasts() {
  for (const subscriber of toastSubscribers) subscriber(toasts);
}

function pushToast(kind: ToastKind, text: string) {
  const id = (toastSeq += 1);
  toasts = [...toasts, { id, kind, text }];
  emitToasts();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emitToasts();
  }, TOAST_DURATION[kind]);
}

/** 轻提示：依次堆叠在窗口顶部，自动消失。 */
export const toast = {
  success: (text: string) => pushToast("success", text),
  error: (text: string) => pushToast("error", text),
  info: (text: string) => pushToast("info", text),
  warning: (text: string) => pushToast("warning", text),
};

let activeRequest: ActiveRequest | null = null;
let dialogSubscriber: ((request: ActiveRequest | null) => void) | null = null;

function requestDialog(request: DialogRequest, resolve: (result: DialogResult) => void) {
  if (!dialogSubscriber) {
    resolve(request.kind === "confirm" ? false : null);
    return;
  }
  // 覆盖排队中的请求：前一个按取消处理，避免回调悬挂。
  activeRequest?.resolve(activeRequest.kind === "confirm" ? false : null);
  activeRequest = {
    ...request,
    resolve: (result) => {
      activeRequest = null;
      resolve(result);
    },
  };
  dialogSubscriber(activeRequest);
}

/** 确认框：返回 true 表示确认，false 表示取消。 */
export function confirmDialog(options: {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    requestDialog(
      {
        kind: "confirm",
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? "确定",
        cancelText: options.cancelText ?? "取消",
      },
      (result) => resolve(result === true),
    );
  });
}

/** 输入框对话框：返回输入内容，取消时返回 null。 */
export function promptDialog(options: {
  title: string;
  message: ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  validate?: (value: string) => string | null;
}): Promise<string | null> {
  return new Promise((resolve) => {
    requestDialog(
      {
        kind: "prompt",
        title: options.title,
        message: options.message,
        defaultValue: options.defaultValue,
        placeholder: options.placeholder,
        validate: options.validate,
        confirmText: options.confirmText ?? "确定",
        cancelText: options.cancelText ?? "取消",
      },
      (result) => resolve(typeof result === "string" ? result : null),
    );
  });
}

/** 顶部轻提示容器，挂载在应用根部。 */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    toastSubscribers.add(setItems);
    setItems(toasts);
    return () => {
      toastSubscribers.delete(setItems);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed top-[46px] left-1/2 z-[60] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col gap-2">
      {items.map((item) => {
        const { icon: Icon, tone } = TOAST_ICON[item.kind];
        return (
          <div
            key={item.id}
            className="pointer-events-auto flex animate-toast-in items-start gap-2.5 rounded-md border border-line bg-panel px-3.5 py-2.5 shadow-popover"
          >
            <Icon size={15} className={cn("mt-px flex-none", tone)} />
            <span className="text-caption leading-[1.5] break-words text-ink">{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 确认框与输入框的宿主，挂载在应用根部。 */
export function DialogHost() {
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscriber = (next: ActiveRequest | null) => {
      setRequest(next);
      setValue(next?.defaultValue ?? "");
      setError(null);
    };
    dialogSubscriber = subscriber;
    return () => {
      dialogSubscriber = null;
    };
  }, []);

  const close = (result: DialogResult) => {
    request?.resolve(result);
    setRequest(null);
  };

  const submit = () => {
    if (!request) return;
    if (request.kind === "confirm") {
      close(true);
      return;
    }
    const message = request.validate?.(value) ?? null;
    if (message) {
      setError(message);
      return;
    }
    close(value);
  };

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) close(request?.kind === "confirm" ? false : null);
      }}
      title={request?.title ?? ""}
      width={440}
      footer={
        <>
          <Button onClick={() => close(request?.kind === "confirm" ? false : null)}>
            {request?.cancelText ?? "取消"}
          </Button>
          <Button variant="primary" onClick={submit}>
            {request?.confirmText ?? "确定"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-body leading-[1.6] text-ink">{request?.message}</div>
        {request?.kind === "prompt" ? (
          <div>
            <Input
              autoFocus
              value={value}
              placeholder={request.placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
            />
            {error ? <div className="mt-1.5 text-micro text-danger">{error}</div> : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
