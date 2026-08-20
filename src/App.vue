<script setup lang="ts">
import { h, onMounted, onUnmounted, ref } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ElMessageBox } from "element-plus";
import { BrainCircuit, ChartColumn, MessageSquareText, Minus, Package, Puzzle, Settings2, Square, X } from "@lucide/vue";
import { loadSettings, saveSettings, type UserSettings } from "./settings";

const appWindow = isTauri() ? getCurrentWindow() : null;

async function runWindowAction(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // Ignore native window errors while the app is shutting down.
  }
}

async function minimizeWindow() {
  if (appWindow) await runWindowAction(() => appWindow.minimize());
}

async function toggleMaximizeWindow() {
  if (appWindow) await runWindowAction(() => appWindow.toggleMaximize());
}

// 关闭行为：根据已记住的偏好直接执行，否则弹窗询问
// - "tray"：隐藏窗口到系统托盘（右下角）
// - "quit"：真正退出
// - null：每次询问
const closeGuard = ref(false);

async function performCloseAction(action: "tray" | "quit") {
  if (!appWindow) return;
  if (action === "tray") {
    await runWindowAction(() => appWindow.hide());
  } else {
    await runWindowAction(() => appWindow.destroy());
  }
}

async function promptClose() {
  if (!appWindow || closeGuard.value) return;
  closeGuard.value = true;
  try {
    const settings = loadSettings();
    // 已记住选择：直接执行
    if (settings.closeAction === "tray" || settings.closeAction === "quit") {
      await performCloseAction(settings.closeAction);
      return;
    }
    // 首次或选择「每次询问」：弹窗
    const toTray = ref(false);
    const remember = ref(false);
    await ElMessageBox({
      title: "关闭窗口",
      message: () =>
        h("div", { class: "close-dialog" }, [
          h("p", { class: "close-dialog__text" }, "确定关闭 Pi Switch 窗口吗？"),
          h("label", { class: "close-dialog__option" }, [
            h("input", {
              type: "checkbox",
              checked: toTray.value,
              onChange: (e: Event) => (toTray.value = (e.target as HTMLInputElement).checked),
            }),
            "放进任务栏（最小化到右下角托盘）",
          ]),
          h("label", { class: "close-dialog__option" }, [
            h("input", {
              type: "checkbox",
              checked: remember.value,
              onChange: (e: Event) => (remember.value = (e.target as HTMLInputElement).checked),
            }),
            "记住选择，以后不再询问",
          ]),
        ]),
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
      closeOnClickModal: false,
    });
    const action: "tray" | "quit" = toTray.value ? "tray" : "quit";
    if (remember.value) {
      saveSettings({ ...settings, closeAction: action });
    }
    await performCloseAction(action);
  } catch {
    // 用户点了取消，窗口保持可见
  } finally {
    closeGuard.value = false;
  }
}

async function closeWindow() {
  await promptClose();
}

// 监听 Rust 侧拦截的关闭请求（兜底 Alt+F4 / 任务栏右键关闭）
let unlistenClose: UnlistenFn | null = null;
onMounted(async () => {
  if (!isTauri()) return;
  unlistenClose = await listen("tauri://close-requested-prompt", () => {
    void promptClose();
  });
});
onUnmounted(() => {
  unlistenClose?.();
});
</script>

<template>
  <div class="app-shell">
    <header class="window-titlebar" data-tauri-drag-region @dblclick="toggleMaximizeWindow">
      <div class="window-controls" @dblclick.stop>
        <button class="window-control" type="button" aria-label="最小化" title="最小化" @click="minimizeWindow">
          <Minus :size="14" :stroke-width="1.8" />
        </button>
        <button class="window-control" type="button" aria-label="最大化或还原" title="最大化或还原" @click="toggleMaximizeWindow">
          <Square :size="11" :stroke-width="1.8" />
        </button>
        <button class="window-control window-control--close" type="button" aria-label="关闭" title="关闭" @click="closeWindow">
          <X :size="14" :stroke-width="1.8" />
        </button>
      </div>
    </header>

    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><BrainCircuit :size="21" :stroke-width="1.8" /></div>
        <div class="brand-copy">
          <strong>Pi Switch</strong>
          <small>Control Center</small>
        </div>
      </div>

      <div class="nav-label">工作台</div>
      <el-menu router :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/usage"><el-icon><ChartColumn /></el-icon><span>用量统计</span><small>01</small></el-menu-item>
        <el-menu-item index="/models"><el-icon><BrainCircuit /></el-icon><span>模型管理</span><small>02</small></el-menu-item>
        <el-menu-item index="/sessions"><el-icon><MessageSquareText /></el-icon><span>对话管理</span><small>03</small></el-menu-item>
        <el-menu-item index="/packages"><el-icon><Package /></el-icon><span>插件管理</span><small>04</small></el-menu-item>
        <el-menu-item index="/skills"><el-icon><Puzzle /></el-icon><span>Skill 管理</span><small>05</small></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Settings2 /></el-icon><span>应用设置</span><small>06</small></el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <span class="status-dot"></span>
        <span>LOCAL / READY</span>
        <span class="version">v0.3.0</span>
      </div>
    </aside>
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
