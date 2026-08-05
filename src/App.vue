<script setup lang="ts">
import { ChatDotRound, Connection, Setting } from "@element-plus/icons-vue";
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">π</div>
        <div class="brand-copy">
          <strong>Pi Switch</strong>
          <small>Control Center</small>
        </div>
      </div>

      <div class="nav-label">工作台</div>
      <el-menu router :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/models"><el-icon><Connection /></el-icon><span>模型管理</span></el-menu-item>
        <el-menu-item index="/sessions"><el-icon><ChatDotRound /></el-icon><span>对话管理</span></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon><span>应用设置</span></el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <span class="status-dot"></span>
        <span>Pi Switch</span>
        <span class="version">v0.2.1</span>
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
