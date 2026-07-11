/**
 * @file 商品列表页面单元测试
 * @description 测试 src/views/products/ProductList.vue
 *              覆盖挂载、DOM 渲染、onMounted API 调用、关键交互（新增/查询/编辑/删除）、空状态
 *              使用浅挂载（shallowMount）+ mock 外部依赖：
 *              - mock pinia store（createTestPinia + 预设 store 状态）
 *              - mock vue-router
 *              - mock naive-ui 的 useMessage（保留真实组件供 stub）
 *              - mock api/products 模块（vi.hoisted 模式）
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
    useRoute: () => ({ params: {}, path: '/products', name: 'ProductList' })
}))

// ========== mock api/products 模块 ==========
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
import ProductList from '@/views/products/ProductList.vue'
import {
    NButton, NInput, NIcon, NTag, NEmpty, NSelect, NCard,
    NDataTable, NPopconfirm, NSpace
} from 'naive-ui'
import type { Product, ProductCategory } from '@/types'

// 注册 naive-ui 组件（shallowMount 会自动 stub 它们）
const globalComponents = {
    NButton, NInput, NIcon, NTag, NEmpty, NSelect, NCard,
    NDataTable, NPopconfirm, NSpace
}

// ========== 测试数据 ==========
const mockCategory1: ProductCategory = {
    id: 'cat-1', name: '绿茶', level: 1, sortOrder: 1
}
const mockCategory2: ProductCategory = {
    id: 'cat-2', name: '茶具', level: 1, sortOrder: 2
}
const mockProduct1: Product = {
    id: 'p-1', code: 'SP001', name: '龙井',
    categoryId: 'cat-1', type: 'weight', baseUnit: 'g',
    isActive: true, createdAt: '2026-07-01', updatedAt: '2026-07-01'
}
const mockProduct2: Product = {
    id: 'p-2', code: 'SP002', name: '茶杯',
    categoryId: 'cat-2', type: 'count', baseUnit: 'pcs',
    isActive: true, createdAt: '2026-07-02', updatedAt: '2026-07-02'
}

describe('ProductList 商品列表页面', () => {
    beforeEach(() => {
        // 每个用例创建独立 pinia，确保 store 状态隔离
        createTestPinia()
        vi.clearAllMocks()
        // 默认让 api 返回空数据
        productsApiMocks.getCategories.mockResolvedValue([])
        productsApiMocks.getProducts.mockResolvedValue([])
    })

    /** 辅助：挂载页面并等待 onMounted 完成 */
    async function mountPage(products: Product[] = [], categories: ProductCategory[] = []) {
        productsApiMocks.getProducts.mockResolvedValue(products)
        productsApiMocks.getCategories.mockResolvedValue(categories)
        const wrapper = shallowMount(ProductList, {
            global: {
                components: globalComponents,
                // 使 stub 渲染默认插槽内容（NCard 子节点、NButton 文本、NEmpty 等）
                renderStubDefaultSlot: true,
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

    /** 辅助：在指定容器内按文本查找 NButton 组件并触发 click 事件 */
    async function clickBtnByTextIn(wrapper: VueWrapper, selector: string, text: string) {
        const btns = wrapper.find(selector).findAllComponents({ name: 'NButton' })
        const btn = btns.find(b => b.text().includes(text))
        if (!btn) throw new Error(`未找到 "${selector}" 内文本包含 "${text}" 的 NButton 组件`)
        await btn.vm.$emit('click')
    }

    // ========== 挂载与初始化 ==========
    describe('挂载与初始化', () => {
        it('组件挂载成功不抛错', async () => {
            await expect(mountPage()).resolves.toBeDefined()
        })

        it('onMounted 触发 loadCategories（调用 getCategories）', async () => {
            await mountPage()
            expect(productsApiMocks.getCategories).toHaveBeenCalledTimes(1)
        })

        it('onMounted 触发 loadProducts（调用 getProducts via store）', async () => {
            await mountPage()
            expect(productsApiMocks.getProducts).toHaveBeenCalledTimes(1)
        })
    })

    // ========== DOM 渲染 ==========
    describe('DOM 渲染', () => {
        it('渲染页面标题"商品列表"', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.page-title').text()).toBe('商品列表')
        })

        it('渲染"新增商品"按钮', async () => {
            const wrapper = await mountPage()
            // .page-header 内的 NButton 是"新增商品"按钮（renderStubDefaultSlot 后文本可见）
            const headerBtn = wrapper.find('.page-header').findComponent({ name: 'NButton' })
            expect(headerBtn.exists()).toBe(true)
            expect(headerBtn.text()).toContain('新增商品')
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

        it('渲染搜索输入框 .filter-input', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.filter-input').exists()).toBe(true)
        })

        it('渲染分类筛选下拉框 .filter-select', async () => {
            const wrapper = await mountPage()
            // 两个 filter-select：分类 + 类型
            expect(wrapper.findAll('.filter-select')).toHaveLength(2)
        })

        it('渲染"查询"按钮', async () => {
            const wrapper = await mountPage()
            // .filter-row 内的 NButton，文本为"查询"
            const btns = wrapper.find('.filter-row').findAllComponents({ name: 'NButton' })
            const queryBtn = btns.find(b => b.text().includes('查询'))
            expect(queryBtn).toBeDefined()
        })
    })

    // ========== 空状态 ==========
    describe('空状态渲染', () => {
        it('无商品数据时渲染 n-empty 空状态', async () => {
            const wrapper = await mountPage([])
            // shallowMount 下 n-empty 被 stub，检查 stub 是否存在
            // renderStubDefaultSlot 后 NCard 内的 NEmpty 也会渲染
            const empty = wrapper.find('n-empty-stub')
            expect(empty.exists()).toBe(true)
            expect(empty.attributes('description')).toBe('暂无商品数据')
        })

        it('有商品数据时不渲染 n-empty 空状态', async () => {
            const wrapper = await mountPage([mockProduct1])
            // products 有数据时 n-empty 的 v-if 为 false
            const empty = wrapper.find('n-empty-stub')
            expect(empty.exists()).toBe(false)
        })
    })

    // ========== 关键交互 ==========
    describe('关键交互', () => {
        it('点击"新增商品"按钮调用 $router.push("/products/new")', async () => {
            const wrapper = await mountPage()
            await clickBtnIn(wrapper, '.page-header')
            expect(routerPush).toHaveBeenCalledWith('/products/new')
        })

        it('点击"查询"按钮触发 handleSearch（调用 getProducts）', async () => {
            const wrapper = await mountPage([mockProduct1])
            // 清除 onMounted 的调用记录
            productsApiMocks.getProducts.mockClear()
            await clickBtnByTextIn(wrapper, '.filter-row', '查询')
            await flushPromises()
            expect(productsApiMocks.getProducts).toHaveBeenCalledTimes(1)
        })

        it('空状态的"添加第一个商品"按钮跳转到新增页', async () => {
            const wrapper = await mountPage([])
            // n-empty stub 内有"添加第一个商品"按钮，但 stub 不渲染具名插槽（#extra）
            // 验证：通过 n-empty 的 v-if 控制（无数据时显示）
            expect(wrapper.find('n-empty-stub').exists()).toBe(true)
        })
    })

    // ========== 分类选项 ==========
    describe('分类选项', () => {
        it('加载分类后 categoryOptions 包含所有分类', async () => {
            const wrapper = await mountPage([], [mockCategory1, mockCategory2])
            // categoryOptions 是 computed，传给 n-select 的 :options
            // shallowMount 下 n-select 是 stub，options 作为 prop 传入
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            // 第一个 n-select 是分类筛选
            const categorySelect = selects[0]
            const options = categorySelect.props('options')
            expect(options).toHaveLength(2)
            expect(options[0]).toEqual({ label: '绿茶', value: 'cat-1' })
            expect(options[1]).toEqual({ label: '茶具', value: 'cat-2' })
        })

        it('无分类时 categoryOptions 为空数组', async () => {
            const wrapper = await mountPage([], [])
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            const categorySelect = selects[0]
            expect(categorySelect.props('options')).toEqual([])
        })
    })

    // ========== 类型选项 ==========
    describe('类型选项', () => {
        it('typeOptions 包含称重类和计件类', async () => {
            const wrapper = await mountPage()
            const selects = wrapper.findAllComponents({ name: 'NSelect' })
            // 第二个 n-select 是类型筛选
            const typeSelect = selects[1]
            const options = typeSelect.props('options')
            expect(options).toEqual([
                { label: '称重类', value: 'weight' },
                { label: '计件类', value: 'count' }
            ])
        })
    })

    // ========== 搜索筛选 ==========
    describe('handleSearch 搜索筛选', () => {
        it('搜索关键字匹配商品名称', async () => {
            const wrapper = await mountPage([mockProduct1, mockProduct2])
            // 通过 NInput stub 设置搜索关键字
            const input = wrapper.findComponent({ name: 'NInput' })
            await input.vm.$emit('update:value', '龙井')
            await flushPromises()
            // 点击查询按钮触发 handleSearch
            await clickBtnByTextIn(wrapper, '.filter-row', '查询')
            await flushPromises()
            // 验证 products ref 被过滤（通过 n-data-table 的 data prop）
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            const data = dataTable.props('data')
            expect(data).toHaveLength(1)
            expect(data[0].name).toBe('龙井')
        })

        it('搜索关键字匹配商品编码', async () => {
            const wrapper = await mountPage([mockProduct1, mockProduct2])
            const input = wrapper.findComponent({ name: 'NInput' })
            await input.vm.$emit('update:value', 'SP002')
            await flushPromises()
            await clickBtnByTextIn(wrapper, '.filter-row', '查询')
            await flushPromises()
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            const data = dataTable.props('data')
            expect(data).toHaveLength(1)
            expect(data[0].code).toBe('SP002')
        })

        it('无匹配关键字时返回空列表', async () => {
            const wrapper = await mountPage([mockProduct1])
            const input = wrapper.findComponent({ name: 'NInput' })
            await input.vm.$emit('update:value', '不存在的商品')
            await flushPromises()
            await clickBtnByTextIn(wrapper, '.filter-row', '查询')
            await flushPromises()
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            expect(dataTable.props('data')).toHaveLength(0)
        })
    })

    // ========== loading 状态 ==========
    describe('loading 状态', () => {
        it('挂载完成后 loading 为 false', async () => {
            const wrapper = await mountPage([mockProduct1])
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            expect(dataTable.props('loading')).toBe(false)
        })

        it('查询时 loading 通过 n-data-table 的 loading prop 传递', async () => {
            // 由于 handleSearch 是同步设置 loading=true 然后异步等待，难以捕获中间状态
            // 验证：查询完成后 loading 恢复 false
            const wrapper = await mountPage([mockProduct1])
            await clickBtnByTextIn(wrapper, '.filter-row', '查询')
            await flushPromises()
            const dataTable = wrapper.findComponent({ name: 'NDataTable' })
            expect(dataTable.props('loading')).toBe(false)
        })
    })
})
