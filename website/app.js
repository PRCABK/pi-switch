const repository = "PRCABK/pi-switch";
const releaseUrl = `https://github.com/${repository}/releases/latest`;

for (const link of document.querySelectorAll("[data-release-link]")) {
  link.href = releaseUrl;
}

fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
  headers: { Accept: "application/vnd.github+json" },
})
  .then((response) => {
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    return response.json();
  })
  .then((release) => {
    const setup = release.assets?.find((asset) => asset.name.endsWith("_windows-x64_setup.exe"));
    const portable = release.assets?.find((asset) => asset.name.endsWith("_windows-x64_portable.zip"));
    const setupLinks = document.querySelectorAll("[data-setup-link]");
    const portableLinks = document.querySelectorAll("[data-portable-link]");
    if (setup) setupLinks.forEach((link) => { link.href = setup.browser_download_url; });
    if (portable) portableLinks.forEach((link) => { link.href = portable.browser_download_url; });
  })
  .catch(() => {
    // GitHub API 不可用时，按钮仍指向最新 Release 页面。
  });

// 移动端菜单
const menuButton = document.querySelector("[data-menu-button]");
const navigation = document.querySelector("[data-navigation]");

menuButton?.addEventListener("click", () => {
  const open = navigation?.classList.toggle("is-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

// 明暗主题：用户选择优先，否则跟随系统。
const themeButton = document.querySelector("[data-theme-toggle]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const storedTheme = localStorage.getItem("pi-switch-site-theme");

function setTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pi-switch-site-theme", theme);
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem("pi-switch-site-theme");
  }
  const dark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  themeColor?.setAttribute("content", dark ? "#121212" : "#fafafa");
}

setTheme(storedTheme);

themeButton?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  setTheme(dark ? "light" : "dark");
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!document.documentElement.dataset.theme) setTheme(null);
});

// 导航栏边界状态，使用观察器替代 scroll 事件。
const header = document.querySelector("[data-header]");
const marker = document.createElement("span");
marker.setAttribute("aria-hidden", "true");
marker.style.cssText = "position:absolute;top:1px;width:1px;height:1px;pointer-events:none";
document.body.prepend(marker);

new IntersectionObserver(([entry]) => {
  header?.classList.toggle("is-scrolled", !entry.isIntersecting);
}).observe(marker);

// 内容进入视口时轻量显现。
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 },
);

document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver.observe(element));

// 原生 dialog 截图预览
const lightbox = document.querySelector("[data-lightbox-dialog]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxClose = document.querySelector("[data-lightbox-close]");

function closeLightbox() {
  if (lightbox?.open) lightbox.close();
}

for (const button of document.querySelectorAll("[data-lightbox]")) {
  button.addEventListener("click", () => {
    const source = button.getAttribute("data-lightbox");
    const image = button.querySelector("img");
    if (!source || !lightbox || !lightboxImage) return;
    lightboxImage.src = source;
    lightboxImage.alt = image?.alt ? `放大查看：${image.alt}` : "放大的 Pi Switch 界面截图";
    lightbox.showModal();
    document.body.classList.add("lightbox-open");
  });
}

lightboxClose?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
lightbox?.addEventListener("close", () => {
  document.body.classList.remove("lightbox-open");
  lightboxImage?.removeAttribute("src");
});
