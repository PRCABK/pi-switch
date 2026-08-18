<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ArrowDownToLine, Boxes, Download, PackagePlus, RefreshCw, Search, Trash2 } from "@lucide/vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";
import { loadSettings } from "../settings";
import type { InstalledPackage, PackageGalleryItem } from "../types";

const loading = ref(false);
const packages = ref<InstalledPackage[]>([]);
const installVisible = ref(false);
const installLoading = ref(false);
const installSource = ref("");
const removeActionId = ref("");
const updateLoading = ref(false);

const galleryVisible = ref(false);
const galleryLoading = ref(false);
const galleryItems = ref<PackageGalleryItem[]>([]);
const gallerySearch = ref("");
const galleryInstallingName = ref("");

const kindColors: Record<string, string> = {
  npm: "primary",
  git: "success",
  local: "info",
};

function errorText(error: unknown): string {
  return typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
}

const sortedPackages = computed(() => {
  return [...packages.value].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.source.localeCompare(b.source);
  });
});

const npmCount = computed(() => packages.value.filter((p) => p.kind === "npm").length);
const gitCount = computed(() => packages.value.filter((p) => p.kind === "git").length);
const localCount = computed(() => packages.value.filter((p) => p.kind === "local").length);

async function loadPackages() {
  loading.value = true;
  try {
    packages.value = await api.listPackages(loadSettings().piPath || undefined);
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    loading.value = false;
  }
}

async function doInstall(source: string): Promise<boolean> {
  installLoading.value = true;
  try {
    const result = await api.installPackage(source, loadSettings().piPath || undefined);
    if (result.success) {
      ElMessage.success(`安装完成：${source}`);
      await loadPackages();
      return true;
    } else {
      ElMessage.error(`安装失败：${result.output || "未知错误"}`);
      return false;
    }
  } catch (error) {
    ElMessage.error(errorText(error));
    return false;
  } finally {
    installLoading.value = false;
  }
}

async function installFromInput() {
  const source = installSource.value.trim();
  if (!source) return ElMessage.warning("请输入插件来源，如 npm:pi-mcp-adapter");
  try {
    await ElMessageBox.confirm(
      `将执行 <span class="code">pi install ${source}</span> 安装插件。插件拥有完整系统访问权限，请确认来源可信。`,
      "安装插件",
      { type: "warning", confirmButtonText: "安装", cancelButtonText: "取消", dangerouslyUseHTMLString: true },
    );
  } catch {
    return;
  }
  const ok = await doInstall(source);
  if (ok) {
    installVisible.value = false;
    installSource.value = "";
  }
}

async function installFromGallery(item: PackageGalleryItem) {
  const command = item.installCommand || `pi install npm:${item.name}`;
  const source = command.replace(/^pi\s+install\s+/, "").trim();
  if (!source) return ElMessage.warning("无法解析安装命令");
  try {
    await ElMessageBox.confirm(
      `将执行 <span class="code">${command}</span> 安装插件。插件拥有完整系统访问权限，请确认来源可信。`,
      `安装 ${item.name}`,
      { type: "warning", confirmButtonText: "安装", cancelButtonText: "取消", dangerouslyUseHTMLString: true },
    );
  } catch {
    return;
  }
  galleryInstallingName.value = item.name;
  const ok = await doInstall(source);
  galleryInstallingName.value = "";
  if (ok) {
    ElMessage.success(`已安装 ${item.name}`);
  }
}

async function removePackage(pkg: InstalledPackage) {
  try {
    await ElMessageBox.confirm(
      `将执行 <span class="code">pi remove ${pkg.source}</span> 卸载该插件，是否继续？`,
      "卸载插件",
      { type: "warning", confirmButtonText: "卸载", cancelButtonText: "取消", dangerouslyUseHTMLString: true },
    );
    removeActionId.value = pkg.source;
    const result = await api.removePackage(pkg.source, loadSettings().piPath || undefined);
    if (result.success) {
      ElMessage.success(`已卸载 ${pkg.source}`);
      await loadPackages();
    } else {
      ElMessage.error(`卸载失败：${result.output || "未知错误"}`);
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(errorText(error));
  } finally {
    removeActionId.value = "";
  }
}

async function updateAllPackages() {
  try {
    await ElMessageBox.confirm(
      "将执行 <span class=\"code\">pi update --extensions</span> 更新所有插件并同步 git 引用，可能需要较长时间。是否继续？",
      "更新插件",
      { type: "warning", confirmButtonText: "更新", cancelButtonText: "取消", dangerouslyUseHTMLString: true },
    );
    updateLoading.value = true;
    const result = await api.updatePackages(loadSettings().piPath || undefined);
    if (result.success) {
      ElMessage.success("插件更新完成");
      await loadPackages();
    } else {
      ElMessage.error(`更新失败：${result.output || "未知错误"}`);
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") ElMessage.error(errorText(error));
  } finally {
    updateLoading.value = false;
  }
}

async function openGallery() {
  galleryVisible.value = true;
  gallerySearch.value = "";
  galleryItems.value = [];
  galleryLoading.value = true;
  try {
    galleryItems.value = await api.searchPackages();
    if (!galleryItems.value.length) ElMessage.info("pi.dev 暂无可用的插件");
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    galleryLoading.value = false;
  }
}

async function searchGallery() {
  galleryLoading.value = true;
  try {
    galleryItems.value = await api.searchPackages(gallerySearch.value || undefined);
    if (!galleryItems.value.length) ElMessage.info("没有找到匹配的插件");
  } catch (error) {
    ElMessage.error(errorText(error));
  } finally {
    galleryLoading.value = false;
  }
}

const filteredGallery = computed(() => {
  const query = gallerySearch.value.trim().toLowerCase();
  if (!query) return galleryItems.value;
  return galleryItems.value.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.provider.toLowerCase().includes(query) ||
      item.types.toLowerCase().includes(query),
  );
});

const installedSources = computed(() => new Set(packages.value.map((p) => p.source)));

function isInstalled(item: PackageGalleryItem): boolean {
  const source = item.installCommand.replace(/^pi\s+install\s+/, "").trim();
  if (installedSources.value.has(source)) return true;
  // Also check by npm name (version-pinned entries).
  const nameOnly = source.split("@")[0];
  return [...installedSources.value].some((s) => s.split("@")[0] === nameOnly);
}

onMounted(loadPackages);
</script>

<template>
  <section class="page packages-page" v-loading="loading">
    <header class="page-header">
      <div class="page-title"><h1>插件管理</h1><p>管理 Pi 的已安装包，安装新插件，浏览 pi.dev 插件市场</p></div>
      <div class="toolbar">
        <el-button :icon="Boxes" @click="openGallery">浏览 pi.dev</el-button>
        <el-button :icon="RefreshCw" @click="loadPackages">刷新</el-button>
        <el-button type="primary" :icon="PackagePlus" @click="installVisible = true">安装插件</el-button>
      </div>
    </header>

    <el-alert class="path-alert" type="info" :closable="false">
      <template #title>
        已安装 <span class="code">{{ packages.length }}</span> 个插件
        <span style="margin-left:14px">npm <strong>{{ npmCount }}</strong></span>
        <span style="margin-left:10px">git <strong>{{ gitCount }}</strong></span>
        <span style="margin-left:10px">local <strong>{{ localCount }}</strong></span>
      </template>
    </el-alert>

    <div class="packages-actions-bar">
      <el-button size="small" :icon="Download" :loading="updateLoading" @click="updateAllPackages">更新全部插件</el-button>
      <span class="muted" style="font-size:12px">运行 pi update --extensions 更新所有插件并同步 git 引用</span>
    </div>

    <el-table :data="sortedPackages" border empty-text="还没有安装插件" style="margin-top:8px">
      <el-table-column label="来源" min-width="280">
        <template #default="scope">
          <span class="code">{{ scope.row.source }}</span>
          <el-tag v-if="scope.row.pinned" size="small" effect="plain" style="margin-left:6px">pinned</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="scope">
          <el-tag size="small" :type="(kindColors[scope.row.kind] as any) || 'info'">{{ scope.row.kind }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="scope" label="范围 / 包名" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="120" align="center">
        <template #default="scope">
          <el-button link type="danger" :icon="Trash2" :loading="removeActionId === scope.row.source" @click="removePackage(scope.row)">卸载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="installVisible" title="安装插件" width="560px" destroy-on-close>
      <div class="install-skill-intro">
        <div class="install-skill-icon"><PackagePlus :size="21" /></div>
        <p>输入 <span class="code">pi install</span> 的来源参数，支持 npm、git 和本地路径。插件拥有完整系统访问权限，请确认来源可信。</p>
      </div>
      <el-form label-position="top" @submit.prevent="installFromInput">
        <el-form-item label="插件来源">
          <el-input v-model="installSource" placeholder="npm:pi-mcp-adapter" clearable @keyup.enter="installFromInput" />
        </el-form-item>
        <div class="muted" style="font-size:12px;line-height:1.6">
          npm：<span class="code">npm:pi-mcp-adapter</span>、<span class="code">npm:@scope/pkg@1.0.0</span><br />
          git：<span class="code">git:github.com/user/repo</span>、<span class="code">https://github.com/user/repo</span><br />
          本地：<span class="code">/absolute/path/to/package</span>、<span class="code">./relative/path</span>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="installVisible = false">取消</el-button>
        <el-button type="primary" :loading="installLoading" :icon="PackagePlus" @click="installFromInput">安装</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="galleryVisible" title="浏览 pi.dev 插件市场" width="960px" destroy-on-close>
      <div class="toolbar gallery-toolbar">
        <el-input v-model="gallerySearch" style="width:300px" placeholder="搜索插件名称、描述、作者或类型" clearable @keyup.enter="searchGallery" />
        <el-button type="primary" :icon="Search" :loading="galleryLoading" @click="searchGallery">搜索</el-button>
        <span class="muted" style="font-size:12px">{{ filteredGallery.length }} / {{ galleryItems.length }} 个</span>
      </div>
      <div v-loading="galleryLoading" class="gallery-grid">
        <article v-for="item in filteredGallery" :key="item.name" class="gallery-card">
          <div class="gallery-card-top">
            <div class="gallery-mark"><Boxes :size="18" :stroke-width="1.7" /></div>
            <div class="gallery-types">
              <el-tag v-for="t in item.types.split(' ').filter(Boolean)" :key="t" size="small" effect="plain">{{ t }}</el-tag>
            </div>
          </div>
          <div class="gallery-copy">
            <h2>{{ item.name }}</h2>
            <p>{{ item.description || "此插件没有提供描述。" }}</p>
          </div>
          <div class="gallery-meta">
            <span>{{ item.provider || "—" }}</span>
            <span>{{ item.downloads }}</span>
            <span>{{ item.updated }}</span>
          </div>
          <div class="gallery-install-box code" :title="item.installCommand">{{ item.installCommand }}</div>
          <div class="gallery-actions">
            <el-button
              size="small"
              type="primary"
              :icon="ArrowDownToLine"
              :loading="galleryInstallingName === item.name"
              :disabled="isInstalled(item)"
              @click="installFromGallery(item)"
            >{{ isInstalled(item) ? "已安装" : "安装" }}</el-button>
          </div>
        </article>
        <div v-if="!galleryLoading && !filteredGallery.length" class="panel gallery-empty">
          <div class="empty-state"><strong>没有匹配的插件</strong><span>尝试更换搜索关键词。</span></div>
        </div>
      </div>
      <template #footer><el-button @click="galleryVisible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.packages-actions-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.gallery-toolbar {
  margin-bottom: 14px;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  max-height: 60vh;
  overflow-y: auto;
}
.gallery-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
  transition: border-color .2s, box-shadow .2s;
}
.gallery-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, .06);
}
.gallery-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.gallery-mark {
  color: var(--el-color-primary);
}
.gallery-types {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.gallery-copy h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.gallery-copy p {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 4px 0 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gallery-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.gallery-install-box {
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gallery-actions {
  display: flex;
  justify-content: flex-end;
}
.gallery-empty {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
}
</style>
