<script setup lang="ts">
import { BrainCircuit, MessageSquareText, Settings2 } from "@lucide/vue";
</script>

<template>
  <div class="app-shell">
    <div class="ambient-shapes" aria-hidden="true">
      <span class="ambient-blob ambient-blob--rose"></span>
      <span class="ambient-blob ambient-blob--cyan"></span>
      <span class="ambient-blob ambient-blob--violet"></span>
      <span class="ambient-line"></span>
    </div>

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
        <el-menu-item index="/models"><el-icon><BrainCircuit /></el-icon><span>模型管理</span><small>01</small></el-menu-item>
        <el-menu-item index="/sessions"><el-icon><MessageSquareText /></el-icon><span>对话管理</span><small>02</small></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Settings2 /></el-icon><span>应用设置</span><small>03</small></el-menu-item>
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
