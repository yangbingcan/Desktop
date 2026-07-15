/**
 * @file 商品管理流程 E2E 测试
 * @description 测试商品列表页面的关键用户流程
 *              覆盖：列表加载、搜索筛选、新增商品导航、编辑导航
 */
import { test, expect } from '@playwright/test'
import { injectMockTauri, mockData } from './fixtures/mock-tauri'

test.describe('商品管理流程', () => {
    test.beforeEach(async ({ page }) => {
        await injectMockTauri(page)
        await page.goto('/#/products')
        await page.waitForLoadState('networkidle')
    })

    test('页面应正确加载并显示商品列表', async ({ page }) => {
        // 验证页面标题
        await expect(page).toHaveTitle(/商品列表/)

        // 验证"新增商品"按钮存在
        await expect(page.locator('button', { hasText: '新增商品' })).toBeVisible()

        // 验证筛选栏存在
        await expect(page.locator('input[placeholder*="搜索商品名称"]')).toBeVisible()
    })

    test('应显示商品表格数据', async ({ page }) => {
        // 等待表格数据加载
        await page.waitForTimeout(500)

        // 验证表格中显示 mock 数据的商品名称
        await expect(page.locator('text=西湖龙井')).toBeVisible({ timeout: 3000 })
        await expect(page.locator('text=碧螺春')).toBeVisible({ timeout: 3000 })
    })

    test('点击新增商品应导航到新增页面', async ({ page }) => {
        // 点击"新增商品"按钮
        await page.locator('button', { hasText: '新增商品' }).click()

        // 验证 URL 变化
        await expect(page).toHaveURL(/\/products\/new/)
    })

    test('搜索框应能过滤商品', async ({ page }) => {
        // 等待表格加载
        await page.waitForTimeout(500)

        // 输入搜索关键词
        await page.locator('input[placeholder*="搜索商品名称"]').fill('龙井')

        // 点击查询按钮
        await page.locator('button', { hasText: '查询' }).click()

        // 等待筛选结果
        await page.waitForTimeout(500)

        // 验证只显示匹配的商品
        await expect(page.locator('text=西湖龙井')).toBeVisible()
        await expect(page.locator('text=碧螺春')).not.toBeVisible()
    })

    test('空商品列表应显示空状态', async ({ page }) => {
        // 注入空数据（override 必须是可序列化的数据，不能是函数；函数会被 JSON.stringify 丢弃）
        await injectMockTauri(page, {
            get_products: { list: [], total: 0, page: 1, pageSize: 100 }
        })
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        // 验证显示空状态（v0.6.0 统一 UI 后空状态文案为「暂无茶叶数据」）
        await expect(page.locator('text=暂无茶叶数据')).toBeVisible({ timeout: 3000 })
    })

    test('筛选栏应包含分类选择器', async ({ page }) => {
        // 验证分类选择器存在
        const categorySelect = page.locator('.n-base-selection').first()
        await expect(categorySelect).toBeVisible()
    })

    test('筛选栏应包含商品类型选择器', async ({ page }) => {
        // 验证类型选择器存在（NSelect 渲染为 .n-base-selection，第二个为类型筛选）
        const typeSelect = page.locator('.n-base-selection').nth(1)
        await expect(typeSelect).toBeVisible()
    })

    test('表格应包含操作列（编辑、删除按钮）', async ({ page }) => {
        // 等待表格加载
        await page.waitForTimeout(500)

        // 验证操作列存在
        await expect(page.locator('text=操作')).toBeVisible()

        // 验证编辑按钮存在
        await expect(page.locator('button', { hasText: '编辑' }).first()).toBeVisible()

        // 验证删除按钮存在
        await expect(page.locator('button', { hasText: '删除' }).first()).toBeVisible()
    })

    test('点击编辑按钮应导航到编辑页面', async ({ page }) => {
        // 等待表格加载
        await page.waitForTimeout(500)

        // 点击第一个编辑按钮
        await page.locator('button', { hasText: '编辑' }).first().click()

        // 验证 URL 变化（导航到编辑页）
        await expect(page).toHaveURL(/\/products\/.+\/edit/)
    })

    test('页面应包含页头标题', async ({ page }) => {
        // v0.6.0 统一 UI 后页头为深茶绿主题的 span（class text-[18px]），无 <h1> 标签
        // 商品档案列表页头文案为「商品档案」
        await expect(page.locator('.tea-page').getByText('商品档案')).toBeVisible()
    })
})
