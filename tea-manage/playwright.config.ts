/**
 * @file Playwright E2E 测试配置
 * @description 配置端到端测试环境
 *
 * 设计思路：
 * - 启动 Vite dev server 作为测试目标（无需 Tauri 后端）
 * - 通过 addInitScript 在浏览器中注入 mock @tauri-apps/api/core 的 invoke
 * - 测试真实的前端用户交互流程（点击、输入、导航）
 * - 适用于 CI 环境和本地开发
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    // 测试目录
    testDir: './tests/e2e',

    // 测试文件匹配规则
    testMatch: '**/*.spec.ts',

    // 全局超时（单个测试最长运行时间）
    timeout: 30_000,

    // expect 断言超时
    expect: {
        timeout: 5_000
    },

    // 并行执行（E2E 测试默认串行，避免端口冲突）
    fullyParallel: false,

    // 失败时不重试（开发阶段便于发现问题）
    retries: 0,

    // 并发工作线程数
    workers: 1,

    // 报告配置
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }]
    ],

    // 全局配置（所有测试用例共享）
    use: {
        // 基础 URL（与 Vite dev server 端口一致）
        baseURL: 'http://localhost:1420',

        // 浏览器视口
        viewport: { width: 1280, height: 800 },

        // 截图策略：仅在失败时截图
        screenshot: 'only-on-failure',

        // 录制视频：仅在失败时保留
        video: 'retain-on-failure',

        // 跟踪：在首次重试时记录
        trace: 'on-first-retry',

        // 导航超时
        navigationTimeout: 10_000,
    },

    // 项目配置（浏览器选择）
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // 自动启动 Vite dev server
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:1420',
        reuseExistingServer: !process.env.CI,  // CI 环境不复用已有 server
        timeout: 60_000,  // 等待 server 启动的最长时长
        stdout: 'ignore',  // 忽略 dev server 日志
        stderr: 'pipe',    // 但保留 stderr 便于排查
    },
})
