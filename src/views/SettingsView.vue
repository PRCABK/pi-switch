<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../api";
import { loadSettings, saveSettings, type UserSettings } from "../settings";
import type { AppInfo } from "../types";

const settings = reactive<UserSettings>(loadSettings());
const info = ref<AppInfo | null>(null);
const infoLoading = ref(false);

// 模块级缓存：首次加载后，再次进入页面直接使用缓存，不再重复请求
let cachedInfo: AppInfo | null = null;

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

async function loadInfo() {
  infoLoading.value = true;
  try {
    info.value = await api.getAppInfo();
    cachedInfo = info.value;
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    infoLoading.value = false;
  }
}

function save() {
  saveSettings({ ...settings });
  ElMessage.success("设置已保存，重新打开页面后生效");
}

function reset() {
  settings.modelsPath = "";
  settings.sessionsDir = "";
  settings.piPath = "";
  save();
}

onMounted(() => {
  if (cachedInfo) {
    info.value = cachedInfo;
  } else {
    loadInfo();
  }
});
</script>

<template>
  <section class="page">
    <header class="page-header"><div class="page-title"><h1>应用设置</h1><p>配置 Pi 可执行文件和数据目录</p></div></header>
    <div class="panel" style="max-width:820px">
      <div class="panel-header"><h2>路径设置</h2></div>
      <div class="panel-body">
        <el-alert type="info" :closable="false" style="margin-bottom:20px">留空时使用 Pi 的默认位置。路径只保存在本机 WebView 的 localStorage 中。</el-alert>
        <el-form label-position="top">
          <el-form-item label="Pi 可执行文件"><el-input v-model="settings.piPath" :placeholder="info?.piVersion ? `pi（检测到 ${info.piVersion}）` : 'pi 或完整路径'" /></el-form-item>
          <el-form-item label="models.json 路径"><el-input v-model="settings.modelsPath" :placeholder="info?.modelsPath || '~/.pi/agent/models.json'" /></el-form-item>
          <el-form-item label="Sessions 目录"><el-input v-model="settings.sessionsDir" :placeholder="info?.sessionsDir || '~/.pi/agent/sessions'" /></el-form-item>
        </el-form>
        <div class="toolbar"><el-button type="primary" @click="save">保存设置</el-button><el-button @click="reset">恢复默认</el-button></div>
      </div>
    </div>
    <div v-if="info" class="panel" style="max-width:820px;margin-top:18px">
      <div class="panel-header"><h2>环境信息</h2><el-button size="small" :loading="infoLoading" @click="loadInfo">重新加载</el-button></div>
      <div class="panel-body"><el-descriptions :column="1" border><el-descriptions-item label="Pi 版本">{{ info.piVersion || "未检测到" }}</el-descriptions-item><el-descriptions-item label="Agent 目录"><span class="code">{{ info.agentDir }}</span></el-descriptions-item><el-descriptions-item label="默认模型配置"><span class="code">{{ info.modelsPath }}</span></el-descriptions-item><el-descriptions-item label="默认对话目录"><span class="code">{{ info.sessionsDir }}</span></el-descriptions-item></el-descriptions></div>
    </div>
  </section>
</template>
