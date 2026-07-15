/**
 * @file Vite 配置文件
 * @description Vite 构建工具配置，包含 UnoCSS、Vue、Tauri 等插件
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
    // v0.7.1 修复回归：Tauri 在 Windows 生产构建会将绝对 /assets/... 改写为
    // http://tauri.localhost/assets/... 导致脚本加载失败、整页白屏。
    // 改为相对路径 './'，由 webview 根据自身源解析，彻底规避该问题。
    base: './',
    plugins: [
        vue(),
        UnoCSS(), // UnoCSS 原子化 CSS
    ],

    // 路径别名
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            // 3. tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
