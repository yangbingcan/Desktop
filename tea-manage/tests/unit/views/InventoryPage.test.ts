/**
 * @file 库存管理页面单元测试
 * @description 测试 src/views/inventory/index.vue
 *              覆盖挂载、DOM 渲染、onMounted API 调用、关键交互（刷新/换页）、空状态
 *              使用浅挂载（shallowMount）+ mock 外部依赖：
 *              - mock pinia store（createTestPinia + 预设 store 状态）
 *              - mock vue-router
 *              - mock naive-ui 的 useMessage（保留真实组件供 stub）
 *              - mock api/inventory、api/products 模块（vi.hoisted 模式）
 *              注意：shallowMount stub 默认不渲染插槽内容，需通过 renderStubDefaultSlot: true
 *              使 NCard/NButton/NEmpty 等 stub 渲染默认插槽子节点。
 *              stub 的 @click 不能通过 trigger('click') 触发，需用 vm.$emit('click')。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createTestPinia } from '../stores/_helpers'

// ========== mock naive-ui（保留真实组件，仅覆盖 useMessage） ==========
const messageMock = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
}))
vi.mock('naive-ui', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return { ...actual, useMessage: () => messageMock }
})

// ========== mock vue-router ==========
const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: routerPush }),
    useRoute: () => ({ params: {}, path: '/inventory', name: 'Inventory' })
}))

// ========== mock api/inventory 模块 ==========
const inventoryApiMocks = vi.hoisted(() => ({
    getInventory: vi.fn(),
    getInventoryDetail: vi.fn(),
    purchaseIn: vi.fn(),
    damageOut: vi.fn(),
    adjustStock: vi.fn()
}))
vi.mock('@/api/inventory', () => inventoryApiMocks)

// ========== mock api/products 模块（store.loadCategories 需要） ==========
const productsApiMocks = vi.hoisted(() => ({
    getProducts: vi.fn(),
    getCategories: vi.fn(),
    getProductUnits: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn()
}))
vi.mock('@/api/products', () => productsApiMocks)

// ========== 导入被测组件与 naive-ui 组件（必须在所有 vi.mock 之后） ==========
import InventoryPage from '@/views/inventory/index.vue'
import {
    NButton, NInput, NIcon, NTag, NEmpty, NSelect, NCard,
    NDataTable, NModal, NSpace, NSpin, NForm, NFormItem,
    NInputNumber, NDescriptions, NDescriptionsItem, NTabs, NTabPane
} from 'naive-ui'
import type { InventoryItem, InventoryDetail, ProductCategory, PageResult } from '@/types'

// 注册 naive-ui 组件（shallowMount 会自动 stub 它们）
const globalComponents = {
    NButton, NInput, NIcon, NTag, NEmpty, NSelect, NCard,
    NDataTable, NModal, NSpace, NSpin, NForm, NFormItem,
    NInputNumber, NDescriptions, NDescriptionsItem, NTabs, NTabPane
}

// ========== 测试数据 ==========
const mockCategory1: ProductCategory = {
    id: 'cat-1', name: '绿茶', level: 1, sortOrder: 1
}
const mockCategory2: ProductCategory = {
    id: 'cat-2', name: '茶具', level: 1, sortOrder: 2
}
const mockInventoryItem1: InventoryItem = {
    productId: 'p-1',
    productName: '龙井',
    categoryName: '绿茶',
    productType: 'weight',
    stockGrams: 500,
    stockUnits: 0,
    displayStock: '500g'
}
const mockInventoryItem2: InventoryItem = {
    productId: 'p-2',
    productName: '茶杯',
    categoryName: '茶具',
    productType: 'count',
    stockGrams: 0,
    stockUnits: 30,
    displayStock: '30个'
}
const mockPageResult: PageResult<InventoryItem> = {
    list: [mockInventoryItem1, mockInventoryItem2],
    total: 2,
    page: 1,
    pageSize: 20
}
const mockEmptyPageResult: PageResult<InventoryItem> = {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20
}

describe('InventoryPage 库存管理页面', () => {
    beforeEach(() => {
        // 每个用例创建独立 pinia，确保 store 状态隔离
        createTestPinia()
        vi.clearAllMocks()
        // 默认让 api 返回空数据
        productsApiMocks.getCategories.mockResolvedValue([])
        productsApiMocks.getProducts.mockResolvedValue([])
        inventoryApiMocks.getInventory.mockResolvedValue(mockEmptyPageResult)
    })

    /** 辅助：挂载页面并等待 onMounted 完成 */
    async function mountPage(
        inventoryResult: PageResult<InventoryItem> = mockEmptyPageResult,
        categories: ProductCategory[] = []
    ) {
        inventoryApiMocks.getInventory.mockResolvedValue(inventoryResult)
        productsApiMocks.getCategories.mockResolvedValue(categories)
        const wrapper = shallowMount(InventoryPage, {
            global: {
                components: globalComponents,
                // 使 stub 渲染默认插槽内容（NCard 子节点、NButton 文本、NEmpty 等）
                renderStubDefaultSlot: true,
                // NModal 自定义空 stub：NModal 默认懒渲染内容（show=false 时不渲染），
                // 但 renderStubDefaultSlot 会让 stub 立即渲染插槽内容，导致
                // purchaseForm.items[0].quantity 等访问 undefined 报错。
                // 此处用空模板覆盖 NModal stub，模拟生产环境懒渲染行为。
                stubs: {
                    NModal: { template: '<div />' }
                },
                mocks: { $router: { push: routerPush } }
            }
        })
        await flushPromises()
        return wrapper
    }

    /** 辅助：在指定容器内查找 NButton 组件并触发 click 事件 */
    async function clickBtnIn(wrapper: VueWrapper, selector: string) {
        const btn = wrapper.find(selector).findComponent({ name: 'NButton' })
        if (!btn.exists()) throw new Error(`未找到 "${selector}" 内的 NButton 组件`)
        await btn.vm.$emit('click')
    }

    // ========== 挂载与初始化 ==========
    describe('挂载与初始化', () => {
        it('组件挂载成功不抛错', async () => {
            await expect(mountPage()).resolves.toBeDefined()
        })

        it('onMounted 触发 productStore.loadCategories（调用 getCategories）', async () => {
            await mountPage()
            expect(productsApiMocks.getCategories).toHaveBeenCalledTimes(1)
        })

        it('onMounted 触发 loadInventory（调用 getInventory）', async () => {
            await mountPage()
            expect(inventoryApiMocks.getInventory).toHaveBeenCalledTimes(1)
        })

        it('getInventory 默认传入 page=1, pageSize=20', async () => {
            await mountPage()
            expect(inventoryApiMocks.getInventory).toHaveBeenCalledWith(1, 20, undefined)
        })
    })

    // ========== DOM 渲染 ==========
    describe('DOM 渲染', () => {
        it('渲染页面标题"库存管理"', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.page-title').text()).toBe('库存管理')
        })

        it('渲染"刷新"按钮', async () => {
            const wrapper = await mountPage()
            // .page-header 内的 NButton 是"刷新"按钮（renderStubDefaultSlot 后文本可见）
            const refreshBtn = wrapper.find('.page-header').findComponent({ name: 'NButton' })
            expect(refreshBtn.exists()).toBe(true)
            expect(refreshBtn.text()).toContain('刷新')
        })

        it('渲染筛选栏 .filter-card', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.filter-card').exists()).toBe(true)
        })

        it('渲染筛选行 .filter-row', async () => {
            const wrapper = await mountPage()
            // .filter-row 在 NCard 的默认插槽内，renderStubDefaultSlot 后可渲染
            expect(wrapper.find('.filter-row').exists()).toBe(true)
        })

        it('渲染分类筛选下拉框 .filter-select', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.filter-select').exists()).toBe(true)
        })

        it('渲染每页条数下拉框 .filter-select-sm', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.filter-select-sm').exists()).toBe(true)
        })
    })

    // ========== 空状态 ==========
    describe('空状态渲染', () => {
        it('无库存数据时渲染 n-empty 空状态', async () => {
            const wrapper = await mountPage(mockEmptyPageResult)
            // renderStubDefaultSlot 后 NCard 内的 NEmpty 也会渲染
            const empty = wrapper.find('n-empty-stub')
            expect(empty.exists()).toBe(true)
            expect(empty.attributes('description')).toBe('暂无库存数据')
        })

        it('有库存数据时不渲染 n-empty 空状态', async () => {
            const wrapper = await mountPage(mockPageResult)
            // 有数据时 n-empty 的 v-if 为 false
            expect(wrapper.find('n-empty-stub').exists()).toBe(false)
        })
    })

    // ========== 关键交互 ==========
    describe('关键交互', () => {
        it('点击"刷新"按钮重新调用 getInventory', async () => {
            const wrapper = await mountPage(mockPageResult)
            // 清除 onMounted 的调用记录
            inventoryApiMocks.getInventory.mockClear()
            await clickBtnIn(wrapper, '.page-header')
            await flushPromises()
            expect(inventoryApiMocks.getInventory).toHaveBeenCalledTimes(1)
        })

        it('切换每页条数后重新调用 getInventory', async () => {
            const wrapper = await mountPage(mockPageResult)
            inventoryApiMocks.getInventory.mockClear()
            // 找到每页条数 select（filter-select-sm）
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            // 第二个 select 是每页条数
            const pageSizeSelect = selects[1]
            await pageSizeSelect.vm.$emit('update:value', 50)
            await flushPromises()
            expect(inventoryApiMocks.getInventory).toHaveBeenCalledWith(1, 50, undefined)
        })

        it('切换分类后重新调用 getInventory（传入 categoryId）', async () => {
            const wrapper = await mountPage(mockPageResult, [mockCategory1])
            inventoryApiMocks.getInventory.mockClear()
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            // 第一个 select 是分类筛选
            const categorySelect = selects[0]
            await categorySelect.vm.$emit('update:value', 'cat-1')
            await flushPromises()
            expect(inventoryApiMocks.getInventory).toHaveBeenCalledWith(1, 20, 'cat-1')
        })
    })

    // ========== 分类选项 ==========
    describe('分类选项', () => {
        it('加载分类后 categoryOptions 包含"全部"和所有分类', async () => {
            const wrapper = await mountPage(mockEmptyPageResult, [mockCategory1, mockCategory2])
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            const categorySelect = selects[0]
            const options = categorySelect.props('options')
            // 包含"全部" + 2个分类
            expect(options).toHaveLength(3)
            expect(options[0]).toEqual({ label: '全部', value: '' })
            expect(options[1]).toEqual({ label: '绿茶', value: 'cat-1' })
            expect(options[2]).toEqual({ label: '茶具', value: 'cat-2' })
        })

        it('无分类时 categoryOptions 仅包含"全部"', async () => {
            const wrapper = await mountPage(mockEmptyPageResult, [])
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            const categorySelect = selects[0]
            const options = categorySelect.props('options')
            expect(options).toEqual([{ label: '全部', value: '' }])
        })
    })

    // ========== 每页条数选项 ==========
    describe('每页条数选项', () => {
        it('pageSize select 包含 20/50/100 三个选项', async () => {
            const wrapper = await mountPage()
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            const pageSizeSelect = selects[1]
            const options = pageSizeSelect.props('options')
            expect(options).toEqual([
                { label: '20条/页', value: 20 },
                { label: '50条/页', value: 50 },
                { label: '100条/页', value: 100 }
            ])
        })
    })

    // ========== loadInventory 错误处理 ==========
    describe('loadInventory 错误处理', () => {
        it('getInventory 抛错时显示错误消息', async () => {
            inventoryApiMocks.getInventory.mockRejectedValue(new Error('加载库存失败'))
            shallowMount(InventoryPage, {
                global: {
                    components: globalComponents,
                    renderStubDefaultSlot: true,
                    // 同 mountPage，用空模板覆盖 NModal stub 避免渲染崩溃
                    stubs: {
                        NModal: { template: '<div />' }
                    },
                    mocks: { $router: { push: routerPush } }
                }
            })
            await flushPromises()
            expect(messageMock.error).toHaveBeenCalledWith('加载库存失败')
        })
    })

    // ========== n-data-table 数据传递 ==========
    describe('n-data-table 数据传递', () => {
        it('inventoryList 数据通过 data prop 传给 n-data-table', async () => {
            const wrapper = await mountPage(mockPageResult)
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            const data = dataTable.props('data')
            expect(data).toHaveLength(2)
            expect(data[0].productName).toBe('龙井')
            expect(data[1].productName).toBe('茶杯')
        })

        it('分页信息通过 pagination prop 传给 n-data-table', async () => {
            const wrapper = await mountPage(mockPageResult)
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            const pagination = dataTable.props('pagination')
            expect(pagination.page).toBe(1)
            expect(pagination.pageSize).toBe(20)
            expect(pagination.itemCount).toBe(2)
        })

        it('挂载完成后 loading 为 false', async () => {
            const wrapper = await mountPage(mockPageResult)
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            expect(dataTable.props('loading')).toBe(false)
        })
    })
})
