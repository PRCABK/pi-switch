import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Minus, Square, X } from "lucide-react";
import { loadSettings, saveSettings } from "../settings";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog } from "./ui/dialog";

const appWindow = isTauri() ? getCurrentWindow() : null;

async function runWindowAction(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // 应用退出过程中忽略原生窗口错误
  }
}

/**
 * 自绘标题栏：透明拖拽区 + 扁平窗口控件。
 * 关闭行为按已记住的偏好直接执行（tray = 隐藏到托盘，quit = 退出），未记住时弹窗询问。
 */
export function TitleBar() {
  const [promptOpen, setPromptOpen] = useState(false);
  const [toTray, setToTray] = useState(false);
  const [remember, setRemember] = useState(false);
  const guardRef = useRef(false);
  const promptCloseRef = useRef<() => void>(() => {});

  async function performCloseAction(action: "tray" | "quit") {
    if (!appWindow) return;
    if (action === "tray") {
      await runWindowAction(() => appWindow.hide());
    } else {
      await runWindowAction(() => appWindow.destroy());
    }
  }

  async function promptClose() {
    if (!appWindow || guardRef.current) return;
    guardRef.current = true;
    const settings = loadSettings();
    if (settings.closeAction === "tray" || settings.closeAction === "quit") {
      await performCloseAction(settings.closeAction);
      guardRef.current = false;
      return;
    }
    setToTray(false);
    setRemember(false);
    setPromptOpen(true);
  }

  promptCloseRef.current = promptClose;

  // 监听 Rust 侧拦截的关闭请求（兜底 Alt+F4 / 任务栏右键关闭）
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: UnlistenFn | null = null;
    void listen("tauri://close-requested-prompt", () => promptCloseRef.current()).then((handler) => {
      unlisten = handler;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  async function confirmClose() {
    setPromptOpen(false);
    guardRef.current = false;
    const action: "tray" | "quit" = toTray ? "tray" : "quit";
    if (remember) saveSettings({ ...loadSettings(), closeAction: action });
    await performCloseAction(action);
  }

  // 取消或按 Esc：释放守卫，窗口保持可见
  function cancelClose() {
    setPromptOpen(false);
    guardRef.current = false;
  }

  return (
    <>
      <header className="window-titlebar" data-tauri-drag-region onDoubleClick={() => void toggleMaximizeWindow()}>
        <div className="window-controls" onDoubleClick={(event) => event.stopPropagation()}>
          <button className="window-control" type="button" aria-label="最小化" title="最小化" onClick={() => void minimizeWindow()}>
            <Minus size={14} strokeWidth={1.8} />
          </button>
          <button
            className="window-control"
            type="button"
            aria-label="最大化或还原"
            title="最大化或还原"
            onClick={() => void toggleMaximizeWindow()}
          >
            <Square size={11} strokeWidth={1.8} />
          </button>
          <button
            className="window-control window-control--close"
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={() => void promptClose()}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <Dialog
        open={promptOpen}
        onOpenChange={(open) => {
          if (!open) cancelClose();
        }}
        title="关闭窗口"
        width={440}
        closeOnOutsideClick={false}
        footer={
          <>
            <Button onClick={cancelClose}>取消</Button>
            <Button variant="primary" onClick={() => void confirmClose()}>
              确定
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body leading-[1.6] text-ink">确定关闭 Pi Switch 窗口吗？</p>
          <Checkbox checked={toTray} onCheckedChange={setToTray}>
            放进任务栏（最小化到右下角托盘）
          </Checkbox>
          <Checkbox checked={remember} onCheckedChange={setRemember}>
            记住选择，以后不再询问
          </Checkbox>
        </div>
      </Dialog>
    </>
  );
}

async function minimizeWindow() {
  if (appWindow) await runWindowAction(() => appWindow.minimize());
}

async function toggleMaximizeWindow() {
  if (appWindow) await runWindowAction(() => appWindow.toggleMaximize());
}
