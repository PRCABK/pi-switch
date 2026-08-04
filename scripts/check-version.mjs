import fs from "node:fs";

const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error("缺少 Tag，例如：v0.1.0");
  process.exit(1);
}

const version = tag.startsWith("v") ? tag.slice(1) : tag;
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (!semver.test(version)) {
  console.error(`Tag 格式无效：${tag}，应使用 v1.2.3 或 v1.2.3-beta.1`);
  process.exit(1);
}

const packageVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const tauriVersion = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const cargoText = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoText.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": packageVersion,
  "src-tauri/tauri.conf.json": tauriVersion,
  "src-tauri/Cargo.toml": cargoVersion,
};

const mismatches = Object.entries(versions).filter(([, value]) => value !== version);
if (mismatches.length) {
  console.error(`Tag ${tag} 与应用版本不一致：`);
  for (const [file, value] of mismatches) console.error(`- ${file}: ${value ?? "未找到"}`);
  process.exit(1);
}

console.log(`版本校验通过：${tag}`);
