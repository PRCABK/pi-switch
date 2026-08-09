<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { FolderInput, PackagePlus, Power, PowerOff, Puzzle, RefreshCw, Trash2 } from "@lucide/vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { SkillCatalog, SkillInfo } from "../types";

const loading = ref(false);
const actionId = ref("");
const filter = ref<"all" | "enabled" | "disabled">("all");
const catalog = ref<SkillCatalog | null>(null);
const installVisible = ref(false);
const installLoading = ref(false);
const sourcePath = ref("");

const filteredSkills = computed(() => {
  const skills = catalog.value?.skills ?? [];
  if (filter.value === "enabled") return skills.filter((skill) => skill.enabled);
  if (filter.value === "disabled") return skills.filter((skill) => !skill.enabled);
  return skills;
});
const enabledCount = computed(() => catalog.value?.skills.filter((skill) => skill.enabled).length ?? 0);
const disabledCount = computed(() => catalog.value?.skills.filter((skill) => !skill.enabled).length ?? 0);

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function loadSkills() {
  loading.value = true;
  try {
    catalog.value = await api.listSkills(loadSettings().skillsDir || undefined);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    loading.value = false;
  }
}

async function installSkill() {
  if (!sourcePath.value.trim()) return ElMessage.warning("请输入 Skill 目录路径");
  installLoading.value = true;
  try {
    const skill = await api.installSkill(sourcePath.value.trim(), loadSettings().skillsDir || undefined);
    installVisible.value = false;
    sourcePath.value = "";
    await loadSkills();
    ElMessage.success(`已安装 ${skill.name}`);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    installLoading.value = false;
  }
}

async function toggleSkill(skill: SkillInfo) {
  actionId.value = skill.id;
  try {
    await api.setSkillEnabled(skill.id, !skill.enabled, loadSettings().skillsDir || undefined);
    await loadSkills();
    ElMessage.success(skill.enabled ? `已停用 ${skill.name}` : `已启用 ${skill.name}`);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    actionId.value = "";
  }
}

async function uninstallSkill(skill: SkillInfo) {
  try {
    await ElMessageBox.confirm(
      `将永久删除 Skill “${skill.name}” 及其目录中的全部文件，是否继续？`,
      "卸载 Skill",
      { type: "warning", confirmButtonText: "卸载", cancelButtonText: "取消" },
    );
    actionId.value = skill.id;
    await api.uninstallSkill(skill.id, skill.enabled, loadSettings().skillsDir || undefined);
    await loadSkills();
    ElMessage.success(`已卸载 ${skill.name}`);
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(errorText(error));
  } finally {
    actionId.value = "";
  }
}

onMounted(loadSkills);
</script>

<template>
  <section class="page skills-page">
    <header class="page-header">
      <div class="page-title"><h1>Skill 管理</h1><p>安装、停用和维护 Pi Agent 的本地能力扩展</p></div>
      <div class="toolbar">
        <el-button :icon="RefreshCw" :loading="loading" @click="loadSkills">刷新</el-button>
        <el-button type="primary" :icon="PackagePlus" @click="installVisible = true">安装 Skill</el-button>
      </div>
    </header>

    <template v-if="catalog">
      <el-alert class="path-alert" type="info" :closable="false">
        <template #title>启用目录：<span class="code">{{ catalog.skillsDir }}</span>　停用目录：<span class="code">{{ catalog.disabledDir }}</span></template>
      </el-alert>

      <div class="skills-summary">
        <div><span class="skill-state-dot skill-state-dot--enabled"></span><strong>{{ enabledCount }}</strong><small>已启用</small></div>
        <div><span class="skill-state-dot"></span><strong>{{ disabledCount }}</strong><small>已停用</small></div>
        <el-radio-group v-model="filter" size="small" class="skill-filter">
          <el-radio-button value="all">全部 {{ catalog.skills.length }}</el-radio-button>
          <el-radio-button value="enabled">已启用</el-radio-button>
          <el-radio-button value="disabled">已停用</el-radio-button>
        </el-radio-group>
      </div>

      <div class="skill-grid" v-loading="loading">
        <article v-for="skill in filteredSkills" :key="`${skill.enabled}-${skill.id}`" class="skill-card" :class="{ 'skill-card--disabled': !skill.enabled }">
          <div class="skill-card-top">
            <div class="skill-mark"><Puzzle :size="19" :stroke-width="1.7" /></div>
            <el-tag :type="skill.enabled ? 'success' : 'info'" effect="plain">{{ skill.enabled ? "已启用" : "已停用" }}</el-tag>
          </div>
          <div class="skill-copy">
            <h2>{{ skill.name }}</h2>
            <p>{{ skill.description || "此 Skill 没有提供描述。" }}</p>
          </div>
          <div class="skill-meta">
            <span>{{ skill.fileCount }} 个文件</span>
            <span>更新于 {{ formatTime(skill.modifiedAt) }}</span>
          </div>
          <div class="skill-path code" :title="skill.path">{{ skill.path }}</div>
          <div class="skill-actions">
            <el-button size="small" :icon="skill.enabled ? PowerOff : Power" :loading="actionId === skill.id" @click="toggleSkill(skill)">{{ skill.enabled ? "停用" : "启用" }}</el-button>
            <el-button size="small" type="danger" plain :icon="Trash2" :disabled="actionId === skill.id" @click="uninstallSkill(skill)">卸载</el-button>
          </div>
        </article>

        <div v-if="!filteredSkills.length" class="panel skill-empty">
          <div class="empty-state"><strong>{{ catalog.skills.length ? "当前筛选下没有 Skill" : "还没有安装 Skill" }}</strong><span>{{ catalog.skills.length ? "切换筛选条件查看其他状态。" : "从包含 SKILL.md 的本地目录安装第一个 Skill。" }}</span></div>
        </div>
      </div>
    </template>

    <el-dialog v-model="installVisible" title="从本地目录安装 Skill" width="560px" destroy-on-close>
      <div class="install-skill-intro">
        <div class="install-skill-icon"><FolderInput :size="21" /></div>
        <p>来源目录必须直接包含 <span class="code">SKILL.md</span>。安装过程只复制文件，不执行 Skill 中的脚本。</p>
      </div>
      <el-form label-position="top" @submit.prevent="installSkill">
        <el-form-item label="Skill 目录路径">
          <el-input v-model="sourcePath" placeholder="C:\path\to\my-skill" clearable @keyup.enter="installSkill" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="installVisible = false">取消</el-button><el-button type="primary" :loading="installLoading" :icon="PackagePlus" @click="installSkill">安装</el-button></template>
    </el-dialog>
  </section>
</template>
