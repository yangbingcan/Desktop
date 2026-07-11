/**
 * @file 零售收银页面单元测试
 * @description 测试 src/views/sales/index.vue
 *              覆盖挂载、DOM 渲染、onMounted API 调用、关键交互（添加商品/结算/挂单/取单）、
 *              金额计算（computed）、空状态渲染
 *              使用浅挂载（shallowMount）+ mock 外部依赖：
 *              - mock @tauri-apps/api/core 的 invoke（通过 mock api 模块间接实现）
 *              - mock pinia store（createTestPinia + 预设 store 状态）
 *              - mock vue-router
 *              - mock naive-ui 的 useMessage（保留真实组件供 stub）
 *              - mock api/sales、api/products 模块（vi.hoisted 模式）
 *              - mock utils/print 的 printReceipt
 *              注意：shallowMount stub 默认不渲染插槽内容，需通过 renderStubDefaultSlot: true
 *              使 NButton/NTag/NCard 等 stub 渲染默认插槽文本/子节点。
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
    useRoute: () => ({ params: {}, path: '/', name: 'Sales' })
}))

// ========== mock api/sales 模块 ==========
const salesApiMocks = vi.hoisted(() => ({
    getMemberByPhone: vi.fn(),
    createSaleOrder: vi.fn(),
    holdOrder: vi.fn(),
    getHeldOrders: vi.fn(),
    getHeldOrderDetail: vi.fn(),
    deleteHeldOrder: vi.fn(),
    // 折扣率/等级名需返回真实计算值，供组件 computed 使用
    getMemberDiscountRate: vi.fn((level: string) =>
        level === 'gold' ? 0.9 : level === 'silver' ? 0.95 : 1.0),
    getMemberLevelName: vi.fn((level: string) =>
        level === 'gold' ? '金卡' : level === 'silver' ? '银卡' : '普通')
}))
vi.mock('@/api/sales', () => salesApiMocks)

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

// ========== mock utils/print 模块 ==========
const printMock = vi.hoisted(() => ({
    printReceipt: vi.fn().mockResolvedValue(undefined),
    printHTML: vi.fn().mockResolvedValue(undefined),
    printPurchaseOrder: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/print', () => printMock)

// ========== 导入被测组件与 naive-ui 组件（必须在所有 vi.mock 之后） ==========
import SalesPage from '@/views/sales/index.vue'
import {
    NButton, NInput, NIcon, NTag, NEmpty, NInputNumber, NModal, NSpace
} from 'naive-ui'
import type { Product, SalesUnit, SaleOrder, HeldOrder } from '@/types'

// 注册 naive-ui 组件（shallowMount 会自动 stub 它们）
const globalComponents = {
    NButton, NInput, NIcon, NTag, NEmpty, NInputNumber, NModal, NSpace
}

// ========== 测试数据 ==========
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
const mockUnit1: SalesUnit = {
    id: 'u-1', productId: 'p-1', name: '50g',
    conversionToBase: 50, retailPrice: 80, memberPrice: 70
}
const mockUnit2: SalesUnit = {
    id: 'u-2', productId: 'p-2', name: '个',
    conversionToBase: 1, retailPrice: 20, memberPrice: 18
}
const mockOrder: SaleOrder = {
    id: 'o-1', orderNo: 'SO20260701001',
    memberId: null, memberName: null,
    totalAmount: 80, discountAmount: 0,
    pointsDeduct: 0, pointsEarned: 8, actualAmount: 80,
    payMethod: 'cash', payStatus: 'paid', status: 'completed',
    remark: null, items: [], createdAt: '2026-07-01 10:00:00'
}
const mockHeldOrder: HeldOrder = {
    id: 'h-1', orderNo: 'HO20260701001',
    memberName: null, itemCount: 1,
    totalAmount: 80, createdAt: '2026-07-01 10:30:00'
}

describe('SalesPage 零售收银页面', () => {
    beforeEach(() => {
        // 每个用例创建独立 pinia，确保 store 状态隔离
        createTestPinia()
        vi.clearAllMocks()
        // 默认让 store 的 loadCategories/loadProducts 成功
        productsApiMocks.getCategories.mockResolvedValue([])
        productsApiMocks.getProducts.mockResolvedValue([])
        productsApiMocks.getProductUnits.mockResolvedValue([mockUnit1])
        printMock.printReceipt.mockResolvedValue(undefined)
    })

    /** 辅助：挂载页面并等待 onMounted 完成 */
    async function mountPage(products: Product[] = []) {
        productsApiMocks.getProducts.mockResolvedValue(products)
        const wrapper = shallowMount(SalesPage, {
            global: {
                components: globalComponents,
                // 使 stub 渲染默认插槽内容（NButton 文本、NTag 文本、NCard 子节点等）
                renderStubDefaultSlot: true,
                mocks: { $router: { push: routerPush } }
            }
        })
        await flushPromises()
        return wrapper
    }

    /** 辅助：按 class 查找 NButton 组件并触发 click 事件 */
    async function clickBtnByClass(wrapper: VueWrapper, className: string) {
        const btn = wrapper.findAllComponents({ name: 'NButton' })
            .find(b => b.classes().includes(className))
        if (!btn) throw new Error(`未找到 class 包含 "${className}" 的 NButton 组件`)
        await btn.vm.$emit('click')
    }

    /** 辅助：在指定容器内查找 NButton 组件并触发 click 事件 */
    async function clickBtnIn(wrapper: VueWrapper, selector: string) {
        const btn = wrapper.find(selector).findComponent({ name: 'NButton' })
        if (!btn.exists()) throw new Error(`未找到 "${selector}" 内的 NButton 组件`)
        await btn.vm.$emit('click')
    }

    /** 辅助：获取所有指定 class 的 NButton 组件（用于多按钮场景） */
    function findBtnsByClass(wrapper: VueWrapper, className: string) {
        return wrapper.findAllComponents({ name: 'NButton' })
            .filter(b => b.classes().includes(className))
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

        it('onMounted 触发 productStore.loadProducts（调用 getProducts）', async () => {
            await mountPage()
            expect(productsApiMocks.getProducts).toHaveBeenCalledTimes(1)
        })

        it('onMounted 加载失败时显示错误消息', async () => {
            productsApiMocks.getCategories.mockRejectedValue(new Error('分类加载失败'))
            shallowMount(SalesPage, {
                global: {
                    components: globalComponents,
                    renderStubDefaultSlot: true,
                    mocks: { $router: { push: routerPush } }
                }
            })
            await flushPromises()
            expect(messageMock.error).toHaveBeenCalledWith(
                expect.stringContaining('页面初始化失败')
            )
        })
    })

    // ========== DOM 渲染 ==========
    describe('DOM 渲染', () => {
        it('渲染页面根节点 .sales-page', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.sales-page').exists()).toBe(true)
        })

        it('渲染左侧商品选择区 .sales-left', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.sales-left').exists()).toBe(true)
        })

        it('渲染右侧购物车面板 .sales-right', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.sales-right').exists()).toBe(true)
        })

        it('渲染购物清单标题', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.cart-title').text()).toBe('购物清单')
        })

        it('渲染"识别会员"按钮文本', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.member-btn').text()).toContain('识别会员')
        })

        it('渲染结算按钮 .checkout-btn', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.checkout-btn').exists()).toBe(true)
            expect(wrapper.find('.checkout-btn').text()).toContain('结算')
        })

        it('渲染 4 个支付方式按钮', async () => {
            const wrapper = await mountPage()
            expect(wrapper.findAll('.pay-method-btn')).toHaveLength(4)
        })

        it('默认现金支付时显示现金找零区 .cash-area', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.cash-area').exists()).toBe(true)
        })

        it('渲染挂单按钮（取单 + 挂单共两个）', async () => {
            const wrapper = await mountPage()
            expect(wrapper.findAll('.hold-btn')).toHaveLength(2)
        })
    })

    // ========== 空状态 ==========
    describe('空状态渲染', () => {
        it('购物车为空时显示 .cart-empty 提示', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.cart-empty').exists()).toBe(true)
            expect(wrapper.find('.cart-empty').text()).toContain('购物车为空')
        })

        it('商品列表为空时不渲染商品网格', async () => {
            const wrapper = await mountPage([])
            expect(wrapper.find('.product-grid').exists()).toBe(false)
        })

        it('无会员时显示会员输入区 .member-placeholder', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.member-placeholder').exists()).toBe(true)
        })
    })

    // ========== 商品列表渲染 ==========
    describe('商品列表渲染', () => {
        it('加载商品后渲染对应数量的商品卡片', async () => {
            const wrapper = await mountPage([mockProduct1, mockProduct2])
            expect(wrapper.findAll('.product-card')).toHaveLength(2)
        })

        it('商品卡片显示商品名称', async () => {
            const wrapper = await mountPage([mockProduct1])
            expect(wrapper.find('.product-card-name').text()).toBe('龙井')
        })

        it('称重类商品卡片显示"称重"标签', async () => {
            const wrapper = await mountPage([mockProduct1])
            expect(wrapper.find('.product-type-tag').text()).toBe('称重')
        })

        it('计件类商品卡片显示"计件"标签', async () => {
            const wrapper = await mountPage([mockProduct2])
            expect(wrapper.find('.product-type-tag').text()).toBe('计件')
        })

        it('搜索关键字过滤商品列表', async () => {
            const wrapper = await mountPage([mockProduct1, mockProduct2])
            // 通过 NInput stub 触发 update:value 事件更新 v-model
            const inputs = wrapper.findAllComponents({ name: 'NInput' })
            const searchInput = inputs.find(i => i.classes().includes('sales-search-input'))
            await searchInput!.vm.$emit('update:value', '龙井')
            await flushPromises()
            expect(wrapper.findAll('.product-card')).toHaveLength(1)
            expect(wrapper.find('.product-card-name').text()).toBe('龙井')
        })
    })

    // ========== 添加商品到购物车 ==========
    describe('addToCart 添加商品到购物车', () => {
        it('点击商品卡片调用 getProductUnits', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(productsApiMocks.getProductUnits).toHaveBeenCalledWith('p-1')
        })

        it('商品只有一个单位时直接加入购物车并提示成功', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(messageMock.success).toHaveBeenCalledWith('已添加：龙井')
            expect(wrapper.findAll('.cart-item')).toHaveLength(1)
        })

        it('商品无销售单位时提示警告', async () => {
            productsApiMocks.getProductUnits.mockResolvedValue([])
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(messageMock.warning).toHaveBeenCalledWith('该商品没有销售单位')
        })

        it('getProductUnits 抛错时显示具体错误信息', async () => {
            productsApiMocks.getProductUnits.mockRejectedValue(new Error('单位查询失败'))
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(messageMock.error).toHaveBeenCalledWith(
                expect.stringContaining('单位查询失败')
            )
        })

        it('重复点击同一商品：购物车仍为一行（数量累加）', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(wrapper.findAll('.cart-item')).toHaveLength(1)
        })
    })

    // ========== 金额计算 ==========
    describe('金额计算（computed）', () => {
        it('添加商品后应付金额正确显示 ¥80.00', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(wrapper.find('.summary-total-amount').text()).toBe('¥80.00')
        })

        it('商品数量正确显示为 1 件', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(wrapper.find('.summary-row').text()).toContain('1 件')
        })

        it('无会员时不显示会员折扣行', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(wrapper.find('.summary-row--discount').exists()).toBe(false)
        })

        it('空购物车时应付金额为 ¥0.00', async () => {
            const wrapper = await mountPage()
            expect(wrapper.find('.summary-total-amount').text()).toBe('¥0.00')
        })
    })

    // ========== 清空购物车 ==========
    describe('clearCart 清空购物车', () => {
        it('点击清空按钮清空购物车', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            expect(wrapper.findAll('.cart-item')).toHaveLength(1)
            // 点击 cart-header 内的清空按钮（通过 vm.$emit 触发 @click）
            await clickBtnIn(wrapper, '.cart-header')
            expect(wrapper.findAll('.cart-item')).toHaveLength(0)
            expect(wrapper.find('.cart-empty').exists()).toBe(true)
        })
    })

    // ========== 结算 ==========
    describe('handleCheckout 结算', () => {
        it('购物车为空时点击结算提示警告', async () => {
            const wrapper = await mountPage()
            await clickBtnByClass(wrapper, 'checkout-btn')
            expect(messageMock.warning).toHaveBeenCalledWith('购物车为空')
        })

        it('现金支付收款不足时提示警告', async () => {
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            // cashReceived 默认为 0，finalAmount 为 80
            await clickBtnByClass(wrapper, 'checkout-btn')
            expect(messageMock.warning).toHaveBeenCalledWith('收款金额不足')
        })

        it('切换微信支付后结算成功', async () => {
            salesApiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            // 切换为微信支付（第二个支付按钮，是普通 div 可用 trigger）
            await wrapper.findAll('.pay-method-btn')[1].trigger('click')
            await clickBtnByClass(wrapper, 'checkout-btn')
            await flushPromises()
            expect(salesApiMocks.createSaleOrder).toHaveBeenCalledTimes(1)
            expect(messageMock.success).toHaveBeenCalledWith(
                expect.stringContaining('结算成功')
            )
        })

        it('结算成功后调用 printReceipt 打印小票', async () => {
            salesApiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            await wrapper.findAll('.pay-method-btn')[1].trigger('click') // 微信
            await clickBtnByClass(wrapper, 'checkout-btn')
            await flushPromises()
            expect(printMock.printReceipt).toHaveBeenCalledWith(mockOrder)
        })

        it('结算成功后清空购物车', async () => {
            salesApiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            await wrapper.findAll('.pay-method-btn')[1].trigger('click')
            await clickBtnByClass(wrapper, 'checkout-btn')
            await flushPromises()
            expect(wrapper.findAll('.cart-item')).toHaveLength(0)
        })

        it('createSaleOrder 传入正确的 input', async () => {
            salesApiMocks.createSaleOrder.mockResolvedValue(mockOrder)
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            await wrapper.findAll('.pay-method-btn')[1].trigger('click') // 微信
            await clickBtnByClass(wrapper, 'checkout-btn')
            await flushPromises()
            expect(salesApiMocks.createSaleOrder).toHaveBeenCalledWith({
                items: [{ productId: 'p-1', unitId: 'u-1', quantity: 1 }],
                memberId: undefined,
                payMethod: 'wechat'
            })
        })

        it('结算失败时显示错误消息', async () => {
            salesApiMocks.createSaleOrder.mockRejectedValue(new Error('结算失败'))
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            await wrapper.findAll('.pay-method-btn')[1].trigger('click') // 微信
            await clickBtnByClass(wrapper, 'checkout-btn')
            await flushPromises()
            expect(messageMock.error).toHaveBeenCalledWith(
                expect.stringContaining('结算失败')
            )
        })
    })

    // ========== 挂单 ==========
    describe('handleHoldOrder 挂单', () => {
        it('购物车为空时点击挂单提示警告', async () => {
            const wrapper = await mountPage()
            const holdBtns = findBtnsByClass(wrapper, 'hold-btn')
            await holdBtns[1].vm.$emit('click') // 第二个是"挂单"
            expect(messageMock.warning).toHaveBeenCalledWith('购物车为空')
        })

        it('挂单成功后调用 holdOrder 并清空购物车', async () => {
            salesApiMocks.holdOrder.mockResolvedValue('h-1')
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            const holdBtns = findBtnsByClass(wrapper, 'hold-btn')
            await holdBtns[1].vm.$emit('click') // 挂单
            await flushPromises()
            expect(salesApiMocks.holdOrder).toHaveBeenCalledTimes(1)
            expect(messageMock.success).toHaveBeenCalledWith('挂单成功')
            expect(wrapper.findAll('.cart-item')).toHaveLength(0)
        })

        it('挂单失败时显示错误消息', async () => {
            salesApiMocks.holdOrder.mockRejectedValue(new Error('挂单失败'))
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            const holdBtns = findBtnsByClass(wrapper, 'hold-btn')
            await holdBtns[1].vm.$emit('click')
            await flushPromises()
            expect(messageMock.error).toHaveBeenCalledWith('挂单失败')
        })
    })

    // ========== 取单 / 挂单列表 ==========
    describe('showHeldOrders 查看挂单列表', () => {
        it('点击取单按钮调用 getHeldOrders', async () => {
            salesApiMocks.getHeldOrders.mockResolvedValue([mockHeldOrder])
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            const holdBtns = findBtnsByClass(wrapper, 'hold-btn')
            await holdBtns[0].vm.$emit('click') // 第一个是"取单"
            await flushPromises()
            expect(salesApiMocks.getHeldOrders).toHaveBeenCalledTimes(1)
        })

        it('getHeldOrders 抛错时不向上抛出（控制台记录）', async () => {
            salesApiMocks.getHeldOrders.mockRejectedValue(new Error('获取挂单失败'))
            const wrapper = await mountPage([mockProduct1])
            await wrapper.find('.product-card').trigger('click')
            await flushPromises()
            const holdBtns = findBtnsByClass(wrapper, 'hold-btn')
            // 不应抛出错误
            await holdBtns[0].vm.$emit('click')
            await flushPromises()
            expect(wrapper.exists()).toBe(true)
        })
    })

    // ========== 会员识别 ==========
    describe('identifyMember 识别会员', () => {
        it('手机号为空时点击"识别"不调用 getMemberByPhone', async () => {
            const wrapper = await mountPage()
            // member-placeholder 内的 n-button 是"识别"按钮
            await clickBtnIn(wrapper, '.member-placeholder')
            expect(salesApiMocks.getMemberByPhone).not.toHaveBeenCalled()
        })

        it('输入手机号后识别会员成功', async () => {
            const mockMember = {
                id: 'm-1', name: '张三', phone: '13800138000',
                gender: null, birthday: null, level: 'gold' as const,
                points: 100, balance: 500, totalConsume: 1000,
                consumeCount: 5, lastVisit: null, createdAt: '2026-01-01'
            }
            salesApiMocks.getMemberByPhone.mockResolvedValue(mockMember)
            const wrapper = await mountPage()
            // 通过 NInput stub 输入手机号
            const inputs = wrapper.findAllComponents({ name: 'NInput' })
            const phoneInput = inputs.find(i => i.classes().includes('member-phone-input'))
            await phoneInput!.vm.$emit('update:value', '13800138000')
            await flushPromises()
            // 点击"识别"按钮（通过 vm.$emit 触发 @click）
            await clickBtnIn(wrapper, '.member-placeholder')
            await flushPromises()
            expect(salesApiMocks.getMemberByPhone).toHaveBeenCalledWith('13800138000')
            expect(messageMock.success).toHaveBeenCalledWith('已识别会员：张三')
            // 识别后显示 member-info
            expect(wrapper.find('.member-info').exists()).toBe(true)
        })
    })
})
