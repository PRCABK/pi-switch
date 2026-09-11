import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    // 固定 IPv4：Tauri CLI 探测 devUrl 时走 127.0.0.1，若只绑 IPv6（Node 默认解析 localhost 得到 ::1）会探测失败。
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
