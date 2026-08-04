import fs from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : "";
    throw new Error(`${command} ${args.join(" ")} 执行失败${detail}`);
  }
  return options.capture ? result.stdout.trim() : "";
}

function git(args, options) {
  return run("git", args, options);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const input = process.argv[2];
if (!input) {
  console.error("用法：npm run release -- 0.2.0");
  process.exit(1);
}

const version = input.startsWith("v") ? input.slice(1) : input;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("版本格式无效，应使用 1.2.3 或 1.2.3-beta.1");
  process.exit(1);
}
const tag = `v${version}`;

try {
  const status = git(["status", "--porcelain"], { capture: true });
  if (status) throw new Error("工作区存在未提交修改，请先提交或暂存后再发布");

  const branch = git(["branch", "--show-current"], { capture: true });
  if (!branch) throw new Error("当前处于 detached HEAD，无法发布");

  git(["fetch", "origin", "--tags"]);
  const localTag = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { stdio: "ignore" });
  if (localTag.status === 0) throw new Error(`Tag ${tag} 已存在`);

  const behind = git(["rev-list", "--count", `HEAD..origin/${branch}`], { capture: true });
  if (behind !== "0") throw new Error(`本地 ${branch} 落后于 origin/${branch}，请先拉取最新代码`);

  run(npmCommand, ["version", version, "--no-git-tag-version", "--allow-same-version"]);

  const tauriPath = "src-tauri/tauri.conf.json";
  const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
  tauriConfig.version = version;
  fs.writeFileSync(tauriPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

  const cargoPath = "src-tauri/Cargo.toml";
  const cargoText = fs.readFileSync(cargoPath, "utf8");
  const updatedCargo = cargoText.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${version}"`);
  if (updatedCargo === cargoText && !cargoText.includes(`version = "${version}"`)) {
    throw new Error("无法更新 src-tauri/Cargo.toml 版本");
  }
  fs.writeFileSync(cargoPath, updatedCargo);

  run(process.execPath, ["scripts/check-version.mjs", tag]);
  run(npmCommand, ["run", "build"]);

  git(["add", "package.json", "package-lock.json", tauriPath, cargoPath]);
  const staged = git(["diff", "--cached", "--name-only"], { capture: true });
  if (staged) {
    git(["commit", "-m", `chore(release): ${tag}`]);
  } else {
    console.log("版本文件已是目标版本，不创建空提交。 ");
  }
  git(["tag", "-a", tag, "-m", `Pi Switch ${tag}`]);
  git(["push", "--atomic", "origin", branch, tag]);

  console.log(`\n${tag} 已推送。GitHub Actions 将自动构建并发布：`);
  console.log(`https://github.com/PRCABK/pi-switch/actions`);
} catch (error) {
  console.error(`发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
