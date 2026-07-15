/**
 * @file Vitest 测试框架配置
 * @description 配置 Vitest 单元测试环境，包含别名、环境、覆盖率等
 *
 * 设计原则：
 * - 复用 vite.config.ts 的别名（@ → src）
 * - 默认使用 jsdom 环境以支持 Vue 组件测试
 * - API 层测试通过 mock @tauri-apps/api/core 的 invoke 实现
 * - 不依赖真实 Tauri 运行时（IPC 契约测试通过静态扫描实现）
 */
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [
        vue(),
        UnoCSS(),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    test: {
        // 全局测试装置：mock @tauri-apps/api/core 的 invoke（v0.7.1 补充，原缺失导致组件测试大面积失败）
        setupFiles: ['tests/setup.ts'],
        // 默认使用 jsdom 环境，支持 DOM API
        environment: 'jsdom',
        // 测试文件匹配规则
        include: [
            'tests/**/*.test.ts',
            'tests/**/*.spec.ts',
            'src/**/*.test.ts',
        ],
        // 排除 node_modules、src-tauri、dist 以及 Playwright E2E 用例
        // （E2E 用例位于 tests/e2e/*.spec.ts，由 @playwright/test 独立运行，
        //   若被 vitest 的 tests/**/*.spec.ts 包含规则误收集会报
        //   "Playwright Test did not expect test.describe()" 错误）
        exclude: [
            'node_modules/**',
            'src-tauri/**',
            'dist/**',
            'tests/e2e/**',
        ],
        // 全局启用（避免每个文件 import describe/it/expect）
        globals: true,
        // 覆盖率配置（可选启用）
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            reportOnFailure: true,
            exclude: [
                'node_modules/**',
                'src-tauri/**',
                'tests/**',
                'src/**/*.d.ts',
                'src/main.ts',
            ],
        },
        // 超时配置（首次加载 Vue 组件可能较慢）
        testTimeout: 10000,
    },
})
