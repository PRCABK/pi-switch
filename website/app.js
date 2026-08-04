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
    const version = release.tag_name || "最新版本";
    document.querySelectorAll("[data-version]").forEach((element) => {
      element.textContent = version;
    });

    const setup = release.assets?.find((asset) => asset.name.endsWith("_windows-x64_setup.exe"));
    const portable = release.assets?.find((asset) => asset.name.endsWith("_windows-x64_portable.zip"));
    const setupLink = document.querySelector("[data-setup-link]");
    const portableLink = document.querySelector("[data-portable-link]");
    if (setup && setupLink) setupLink.href = setup.browser_download_url;
    if (portable && portableLink) portableLink.href = portable.browser_download_url;
  })
  .catch(() => {
    document.querySelectorAll("[data-version]").forEach((element) => {
      element.textContent = "最新版本";
    });
  });

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

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 },
);

document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
