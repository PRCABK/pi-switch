<script setup lang="ts">
import { ChatDotRound, Connection, Setting } from "@element-plus/icons-vue";
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">π</div>
        <div>
          <strong>Pi Switch</strong>
          <small>模型与对话管理</small>
        </div>
      </div>
      <el-menu router :default-active="$route.path" class="nav-menu">
        <el-menu-item index="/models"><el-icon><Connection /></el-icon><span>模型管理</span></el-menu-item>
        <el-menu-item index="/sessions"><el-icon><ChatDotRound /></el-icon><span>对话管理</span></el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon><span>应用设置</span></el-menu-item>
      </el-menu>
      <div class="sidebar-footer">Pi Switch v0.1.0</div>
    </aside>
    <main class="main-content"><router-view /></main>
  </div>
</template>
