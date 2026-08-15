<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrainCircuit, ChartColumn, MessageSquareText, Minus, Puzzle, Settings2, Square, X } from "@lucide/vue";

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

async function closeWindow() {
  if (appWindow) await runWindowAction(() => appWindow.close());
}
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
        <el-menu-item index="/skills"><el-icon><Puzzle /></el-icon><span>Skill 管理</span><small>04</small></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Settings2 /></el-icon><span>应用设置</span><small>05</small></el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <span class="status-dot"></span>
        <span>LOCAL / READY</span>
        <span class="version">v0.2.5</span>
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
