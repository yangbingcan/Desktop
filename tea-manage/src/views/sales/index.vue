<!--
  @file 零售收银页面
  @description 收银台主页面 - 扁平 POS 双栏布局（左商品选择 + 右购物清单）
            基于 v0.6.0 前原版设计还原，配色统一为深茶绿主题。
            业务逻辑（购物车 / 挂单 / 结算 / 会员 / 单位选择 / 现金找零 / 打印小票）保持不变。
-->
<template>
    <div class="tea-page p-md pos-page">
        <!-- 第一行：搜索 + 识别会员 -->
        <div class="pos-top-bar">
            <div class="pos-search">
                <n-input
                    v-model:value="searchKeyword"
                    placeholder="搜索商品名称 / 编码 / 拼音首字母"
                    clearable
                    size="large"
                    @keyup.enter="handleSearchOrMember"
                >
                    <template #prefix>
                        <span class="i-mdi-magnify align-middle text-[16px]" />
                    </template>
                </n-input>
            </div>
            <n-button size="large" @click="identifyMember">
                <template #icon>
                    <span class="i-mdi-account align-middle" />
                </template>
                识别会员
            </n-button>
        </div>

        <!-- 主体：左商品 + 右购物车 -->
        <div class="pos-body">
            <!-- ====== 左侧：商品选择 ====== -->
            <div class="pos-products">
                <!-- 分类筛选 -->
                <div class="pos-categories">
                    <n-button
                        v-for="cat in categoryOptions"
                        :key="cat.value"
                        size="small"
                        round
                        :type="(selectedCategoryId || '') === cat.value ? 'primary' : 'default'"
                        @click="selectedCategoryId = cat.value || null"
                    >
                        {{ cat.label }}
                    </n-button>
                </div>

                <!-- 商品网格 -->
                <div class="pos-grid">
                    <div
                        v-for="product in filteredProducts"
                        :key="product.id"
                        class="pos-product-card"
                        @click="addToCart(product)"
                    >
                        <span class="pos-product-name">{{ product.name }}</span>
                        <n-tag size="small" :bordered="false" :type="product.type === 'weight' ? 'warning' : 'info'">
                            {{ product.type === 'weight' ? '称重' : '计件' }}
                        </n-tag>
                    </div>
                </div>
                <n-empty
                    v-if="filteredProducts.length === 0"
                    description="暂无商品，请先添加商品"
                    :style="{ gridColumn: '1 / -1' }"
                />
            </div>

            <!-- ====== 右侧：购物清单 ====== -->
            <div class="pos-cart">
                <!-- 头部：购物清单 + 清空 -->
                <div class="pos-cart-header">
                    <span class="pos-cart-title">购物清单</span>
                    <n-button text type="error" size="small" :disabled="cartItems.length === 0" @click="clearCart">清空</n-button>
                </div>

                <!-- 会员识别区 -->
                <div v-if="currentMember" class="pos-member-info">
                    <span class="i-mdi-account text-[18px] align-middle text-tea-primary" />
                    <n-text strong>{{ currentMember.name }}</n-text>
                    <n-tag size="small" :bordered="false" :type="currentMember.level === 'gold' ? 'warning' : currentMember.level === 'silver' ? 'info' : 'default'">
                        {{ getMemberLevelName(currentMember.level) }}
                    </n-tag>
                    <n-text depth="3" class="ml-auto">积分: {{ currentMember.points }}</n-text>
                </div>
                <div v-else class="pos-member-input">
                    <n-input
                        v-model:value="memberPhoneInput"
                        placeholder="手机号 / 后4位"
                        size="small"
                        @keyup.enter="identifyMemberByPhone"
                    />
                    <n-button size="small" @click="identifyMemberByPhone">识别</n-button>
                </div>

                <!-- 购物列表 -->
                <div class="pos-cart-list">
                    <div v-if="cartItems.length > 0" class="pos-items">
                        <div v-for="(item, index) in cartItems" :key="index" class="pos-item">
                            <div class="pos-item-info">
                                <n-text strong depth="1" class="block truncate">{{ item.productName }}</n-text>
                                <n-text depth="3" class="text-[11px]">
                                    {{ item.unitName }} / <span class="font-mono">{{ formatMoney(item.price) }}</span>
                                </n-text>
                            </div>
                            <n-input-number
                                :value="item.quantity"
                                :min="1"
                                size="small"
                                style="width: 80px"
                                @update:value="(v: number | null) => v && updateQuantity(item, v)"
                            />
                            <n-text type="primary" strong class="font-mono pos-item-subtotal">{{ formatMoney(item.subtotal) }}</n-text>
                            <n-button text size="small" type="error" @click="removeItem(index)">
                                <template #icon><span class="i-mdi-close align-middle" /></template>
                            </n-button>
                        </div>
                    </div>
                    <n-empty v-else description="点击左侧商品添加到购物车">
                        <template #icon>
                            <span class="i-mdi-cart-outline text-[40px] text-[var(--tea-content-4)]" />
                        </template>
                    </n-empty>
                </div>

                <!-- 汇总区 -->
                <div class="pos-summary">
                    <div class="pos-summary-row">
                        <n-text depth="2">商品数量</n-text>
                        <n-text depth="2">{{ totalItems }} 件</n-text>
                    </div>
                    <div v-if="discountAmount > 0" class="pos-summary-row">
                        <n-text type="success">会员折扣</n-text>
                        <n-text type="success" class="font-mono">-{{ formatMoney(discountAmount) }}</n-text>
                    </div>
                    <div class="pos-total-row">
                        <n-text strong>应付金额</n-text>
                        <n-text type="primary" strong class="font-mono pos-total-amount">{{ formatMoney(finalAmount) }}</n-text>
                    </div>
                </div>

                <!-- 支付方式 -->
                <n-button-group class="pos-pay-methods" size="small">
                    <n-button
                        v-for="m in payMethods"
                        :key="m.value"
                        :type="selectedPayMethod === m.value ? 'primary' : 'default'"
                        @click="selectedPayMethod = m.value"
                    >
                        {{ m.label }}
                    </n-button>
                </n-button-group>

                <!-- 现金收款 / 找零 -->
                <div v-if="selectedPayMethod === 'cash'" class="pos-cash-area">
                    <div class="pos-cash-input">
                        <n-text strong>收款</n-text>
                        <n-input-number
                            v-model:value="cashReceived"
                            :min="0"
                            placeholder="输入收款金额"
                            :show-button="true"
                        />
                    </div>
                    <div class="pos-change">
                        <n-text depth="2">找零：</n-text>
                        <n-text type="success" strong class="font-mono">{{ formatMoney(changeAmount) }}</n-text>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="pos-actions">
                    <n-button :disabled="cartItems.length === 0" @click="showHeldOrders">
                        <template #icon><span class="i-mdi-playlist-plus align-middle" /></template>
                        取单 ({{ heldOrders.length }})
                    </n-button>
                    <n-button :disabled="cartItems.length === 0" @click="handleHoldOrder">
                        <template #icon><span class="i-mdi-bookmark align-middle" /></template>
                        挂单
                    </n-button>
                    <n-button
                        type="primary"
                        size="large"
                        :disabled="cartItems.length === 0"
                        :loading="processing"
                        class="pos-checkout-btn"
                        @click="handleCheckout"
                    >
                        结算 {{ formatMoney(finalAmount) }}
                    </n-button>
                </div>
            </div>
        </div>

        <!-- 单位选择弹窗 -->
        <n-modal
            v-model:show="unitSelectVisible"
            preset="card"
            title="选择购买单位"
            style="width: 400px"
        >
            <n-list hoverable>
                <n-list-item
                    v-for="unit in selectedProductUnits"
                    :key="unit.id"
                    class="cursor-pointer"
                    @click="onUnitSelected(unit)"
                >
                    <div class="flex items-center justify-between">
                        <n-text>{{ unit.name }}</n-text>
                        <n-text type="primary" class="font-mono">{{ formatMoney(unit.retailPrice) }}</n-text>
                    </div>
                </n-list-item>
            </n-list>
        </n-modal>

        <!-- 挂单列表弹窗 -->
        <n-modal
            v-model:show="heldOrdersVisible"
            preset="card"
            title="挂起的订单"
            style="width: 500px"
        >
            <n-empty v-if="heldOrders.length === 0" description="暂无挂起的订单" />
            <n-list v-else hoverable>
                <n-list-item v-for="order in heldOrders" :key="order.id">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <n-text strong>{{ order.orderNo }}</n-text>
                            <n-tag v-if="order.memberName" size="small" type="info" :bordered="false">{{ order.memberName }}</n-tag>
                        </div>
                        <div class="flex items-center gap-2">
                            <n-text depth="3">{{ order.itemCount }} 件商品</n-text>
                            <n-text type="primary" class="font-mono">{{ formatMoney(order.totalAmount) }}</n-text>
                        </div>
                        <n-space :size="8">
                            <n-button size="small" type="primary" @click="resumeOrder(order.id)">取单</n-button>
                            <n-button size="small" type="error" @click="removeHeldOrder(order.id)">删除</n-button>
                        </n-space>
                    </div>
                </n-list-item>
            </n-list>
        </n-modal>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 零售收银页面
 * @description 收银台主页面 - 购物车 / 挂单 / 结算 / 会员识别 / 单位选择 / 现金找零 / 打印小票
 * @refactor v0.6.1 模板还原为原版扁平 POS 布局（去 n-card title/header 包裹，
 *            搜索与识别会员同行，茶绿配色）。业务逻辑完全保留。
 */
import { ref, computed, onMounted } from 'vue'
import { getProductUnits } from '@/api/products'
import { useProductStore } from '@/stores'
import {
    getMemberByPhone, createSaleOrder, holdOrder, getHeldOrders, getHeldOrderDetail, deleteHeldOrder,
    getMemberDiscountRate, getMemberLevelName
} from '@/api/sales'
import type { Member, SaleOrderInput, SaleItemInput, HeldOrder, CartItem, SalesUnit, Product } from '@/types'
import { printReceipt } from '@/utils/print'
import { useMessage } from 'naive-ui'

const message = useMessage()
const productStore = useProductStore()

// 搜索
const searchKeyword = ref('')
const selectedCategoryId = ref<string | null>(null)
const memberPhoneInput = ref('')

// 购物车
const cartItems = ref<CartItem[]>([])
const currentMember = ref<Member | null>(null)

// 支付
const selectedPayMethod = ref('cash')
const cashReceived = ref(0)
const processing = ref(false)

// 挂单相关
const heldOrdersVisible = ref(false)
const heldOrders = ref<HeldOrder[]>([])

// 商品选择弹窗
const unitSelectVisible = ref(false)
const selectedProductUnits = ref<SalesUnit[]>([])
const selectedProductForUnit = ref<Product | null>(null)

// 分类选项
const categoryOptions = computed(() => {
    return [
        { label: '全部', value: '' },
        ...productStore.categories.map(c => ({ label: c.name, value: c.id }))
    ]
})

// 过滤后的商品
const filteredProducts = computed(() => {
    let products = productStore.products

    if (selectedCategoryId.value) {
        products = products.filter(p => p.categoryId === selectedCategoryId.value)
    }

    if (searchKeyword.value) {
        const kw = searchKeyword.value.toLowerCase()
        products = products.filter(p =>
            p.name.toLowerCase().includes(kw) ||
            p.code.toLowerCase().includes(kw)
        )
    }

    return products
})

// 金额计算
const totalAmount = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + item.subtotal, 0)
})

const discountAmount = computed(() => {
    if (!currentMember.value) return 0
    const rate = getMemberDiscountRate(currentMember.value.level)
    return totalAmount.value * (1 - rate)
})

const finalAmount = computed(() => {
    return totalAmount.value - discountAmount.value
})

const totalItems = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + item.quantity, 0)
})

const changeAmount = computed(() => {
    if (selectedPayMethod.value !== 'cash') return 0
    return Math.max(0, cashReceived.value - finalAmount.value)
})

// 购物方式选项
const payMethods = [
    { label: '现金', value: 'cash' },
    { label: '微信', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: '会员卡', value: 'memberBalance' }
]

/** 搜索框回车：如果输入的是手机号则识别会员，否则不处理 */
function handleSearchOrMember() {
    // 搜索是自动的（computed），无需额外处理
}

/** 添加商品到购物车 */
async function addToCart(product: Product) {
    try {
        if (!product || !product.id) {
            message.error('商品数据异常，缺少 ID')
            return
        }
        const units = await getProductUnits(product.id)
        if (!units || units.length === 0) {
            message.warning('该商品没有销售单位')
            return
        }

        if (units.length === 1) {
            const unit = units[0]
            const cartItem: CartItem = {
                productId: product.id,
                productName: product.name,
                unitId: unit.id,
                unitName: unit.name,
                quantity: 1,
                price: unit.retailPrice,
                grams: unit.conversionToBase,
                subtotal: unit.retailPrice
            }

            const existingIndex = cartItems.value.findIndex(
                item => item.productId === product.id && item.unitId === unit.id
            )

            if (existingIndex >= 0) {
                cartItems.value[existingIndex].quantity++
                cartItems.value[existingIndex].subtotal =
                    cartItems.value[existingIndex].quantity * cartItems.value[existingIndex].price
            } else {
                cartItems.value.push(cartItem)
            }
            message.success(`已添加：${product.name}`)
        } else {
            selectedProductUnits.value = units
            selectedProductForUnit.value = product
            unitSelectVisible.value = true
        }
    } catch (error: any) {
        console.error('添加商品失败:', error)
        // 🔧 v0.3.2 修复：显示具体错误信息而非写死的"添加商品失败"
        const errMsg = typeof error === 'string' ? error
            : error?.message || error?.toString?.() || JSON.stringify(error) || '未知错误'
        message.error(`添加商品失败：${errMsg}`)
    }
}

/** 选择单位后添加到购物车 */
function onUnitSelected(unit: SalesUnit) {
    const product = selectedProductForUnit.value
    if (!product) return

    const cartItem: CartItem = {
        productId: product.id,
        productName: product.name,
        unitId: unit.id,
        unitName: unit.name,
        quantity: 1,
        price: unit.retailPrice,
        grams: unit.conversionToBase,
        subtotal: unit.retailPrice
    }

    const existingIndex = cartItems.value.findIndex(
        item => item.productId === product.id && item.unitId === unit.id
    )

    if (existingIndex >= 0) {
        cartItems.value[existingIndex].quantity++
        cartItems.value[existingIndex].subtotal =
            cartItems.value[existingIndex].quantity * cartItems.value[existingIndex].price
    } else {
        cartItems.value.push(cartItem)
    }

    unitSelectVisible.value = false
}

/** 更新数量 */
function updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity < 1) return
    item.quantity = newQuantity
    item.subtotal = item.quantity * item.price
}

/** 移除商品 */
function removeItem(index: number) {
    cartItems.value.splice(index, 1)
}

/** 清空购物车 */
function clearCart() {
    cartItems.value = []
    currentMember.value = null
}

/** 识别会员（顶部按钮） */
async function identifyMember() {
    const phone = memberPhoneInput.value || searchKeyword.value
    if (!phone) {
        message.info('请输入手机号')
        return
    }

    try {
        const member = await getMemberByPhone(phone)
        if (member) {
            currentMember.value = member
            message.success(`已识别会员：${member.name}`)
        } else {
            message.info('未找到该手机号的会员')
        }
    } catch (error) {
        console.error('识别会员失败:', error)
    }
}

/** 通过手机号识别会员（右侧区域） */
async function identifyMemberByPhone() {
    if (!memberPhoneInput.value) return
    try {
        const member = await getMemberByPhone(memberPhoneInput.value)
        if (member) {
            currentMember.value = member
            message.success(`已识别会员：${member.name}`)
        } else {
            message.info('未找到该手机号的会员')
        }
    } catch (error) {
        console.error('识别会员失败:', error)
    }
}

/**
 * 校验支付方式（v0.3.1 M06 储值余额）
 * 当选择会员卡支付时，校验：
 * 1. 已识别会员
 * 2. 会员余额 ≥ 实付金额
 * @returns true=校验通过，false=校验失败（已提示）
 */
function validatePayMethod(): boolean {
    if (selectedPayMethod.value === 'memberBalance') {
        if (!currentMember.value) {
            message.warning('请先识别会员')
            return false
        }
        const balance = currentMember.value.balance || 0
        if (balance < finalAmount.value) {
            message.warning(
                `会员余额不足，当前余额 ¥${balance.toFixed(2)}，` +
                `需要支付 ¥${finalAmount.value.toFixed(2)}`
            )
            return false
        }
    }
    return true
}

/** 结算 */
async function handleCheckout() {
    if (cartItems.value.length === 0) {
        message.warning('购物车为空')
        return
    }

    // v0.3.1: 余额扣款校验
    if (!validatePayMethod()) {
        return
    }

    if (selectedPayMethod.value === 'cash' && cashReceived.value < finalAmount.value) {
        message.warning('收款金额不足')
        return
    }

    processing.value = true
    try {
        const input: SaleOrderInput = {
            items: cartItems.value.map((item): SaleItemInput => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity
            })),
            memberId: currentMember.value?.id,
            payMethod: selectedPayMethod.value
        }

        const result = await createSaleOrder(input)
        message.success(`结算成功！订单号：${result.orderNo}`)

        // 打印小票
        try {
            await printReceipt(result)
        } catch (e) {
            console.error('打印小票失败:', e)
        }

        // 清空购物车
        cartItems.value = []
        currentMember.value = null
        cashReceived.value = 0
    } catch (error) {
        console.error('结算失败:', error)
        message.error('结算失败：' + String(error ?? '未知错误'))
    } finally {
        processing.value = false
    }
}

/** 挂单 */
async function handleHoldOrder() {
    if (cartItems.value.length === 0) {
        message.warning('购物车为空')
        return
    }

    try {
        const input: SaleOrderInput = {
            items: cartItems.value.map((item): SaleItemInput => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity
            })),
            memberId: currentMember.value?.id
        }

        await holdOrder(input)
        message.success('挂单成功')
        cartItems.value = []
        currentMember.value = null
    } catch (error) {
        console.error('挂单失败:', error)
        message.error('挂单失败')
    }
}

/** 查看挂起的订单 */
async function showHeldOrders() {
    try {
        heldOrders.value = await getHeldOrders()
        heldOrdersVisible.value = true
    } catch (error) {
        console.error('获取挂单失败:', error)
    }
}

/** 取单 */
async function resumeOrder(orderId: string) {
    try {
        const order = await getHeldOrderDetail(orderId)

        cartItems.value = order.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            unitId: item.unitId,
            unitName: item.unitName,
            quantity: item.quantity,
            price: item.unitPrice,
            grams: item.grams,
            subtotal: item.subtotal
        }))

        if (order.memberId) {
            currentMember.value = { id: order.memberId, name: order.memberName || '', phone: '', level: 'normal', points: 0, balance: 0, totalConsume: 0, consumeCount: 0, lastVisit: null, createdAt: '', gender: null, birthday: null }
        }

        heldOrdersVisible.value = false
        message.success('已取单')
    } catch (error) {
        console.error('取单失败:', error)
        message.error('取单失败')
    }
}

/** 删除挂起的订单 */
async function removeHeldOrder(orderId: string) {
    try {
        await deleteHeldOrder(orderId)
        heldOrders.value = heldOrders.value.filter(o => o.id !== orderId)
        message.success('已删除挂单')
    } catch (error) {
        console.error('删除挂单失败:', error)
        message.error('删除挂单失败')
    }
}

/** 格式化金额 */
function formatMoney(amount: number): string {
    return '¥' + amount.toFixed(2)
}

onMounted(async () => {
    try {
        await productStore.loadCategories()
        await productStore.loadProducts()
    } catch (e: any) {
        console.error('零售收银页面初始化失败:', e)
        const errMsg = typeof e === 'string' ? e
            : e?.message || e?.toString?.() || JSON.stringify(e) || '未知错误'
        message.error(`页面初始化失败：${errMsg}`)
    }
})
</script>

<style scoped>
/* ========== 扁平 POS 收银台布局（还原原版）========== */

/* 顶栏：搜索 + 识别会员 */
.pos-top-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}
.pos-search {
    flex: 1;
}

/* 主体双栏 */
.pos-body {
    display: flex;
    gap: 16px;
    min-height: 0;
}
.pos-products {
    flex: 1 1 58%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}
.pos-cart {
    width: 320px;
    flex-shrink: 0;
    background: var(--tea-surface-1);
    border-radius: var(--tea-radius-md);
    border: 1px solid var(--tea-line-1);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* 分类标签行 */
.pos-categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* 商品网格 */
.pos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 10px;
    min-height: 200px;
}
.pos-product-card {
    background: var(--tea-surface);
    border: 1px solid var(--tea-line-1);
    border-radius: var(--tea-radius-sm);
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: box-shadow 0.15s, border-color 0.15s;
}
.pos-product-card:hover {
    box-shadow: 0 2px 8px rgba(74, 103, 65, 0.12);
    border-color: var(--tea-primary-supply);
}
.pos-product-name {
    font-size: 13px;
    color: var(--tea-content-1);
    text-align: center;
    line-height: 1.35;
    word-break: break-all;
}

/* 购物清单头部 */
.pos-cart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--tea-line-1);
}
.pos-cart-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--tea-content-1);
}

/* 会员区 */
.pos-member-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: var(--tea-surface-2);
    border-radius: var(--tea-radius-sm);
    flex-wrap: wrap;
}
.pos-member-input {
    display: flex;
    gap: 6px;
}

/* 购物列表 */
.pos-cart-list {
    flex: 1;
    overflow-y: auto;
    min-height: 120px;
    max-height: 32vh;
}
.pos-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.pos-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px dashed var(--tea-line-2);
}
.pos-item:last-child {
    border-bottom: none;
}
.pos-item-info {
    flex: 1;
    min-width: 0;
}
.pos-item-subtotal {
    min-width: 56px;
    text-align: right;
}

/* 汇总区 */
.pos-summary {
    padding: 8px 0;
    border-top: 1px dashed var(--tea-line-1);
}
.pos-summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
}
.pos-total-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px dashed var(--tea-line-1);
}
.pos-total-amount {
    font-size: 22px;
}

/* 支付方式 */
.pos-pay-methods {
    width: 100%;
}

/* 现金收款 */
.pos-cash-area {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--tea-bg-elevated);
    border-radius: var(--tea-radius-sm);
    border: 1px solid var(--tea-line-1);
}
.pos-cash-input {
    display: flex;
    align-items: center;
    gap: 8px;
}
.pos-cash-input .n-input-number {
    flex: 1;
}
.pos-change {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 17px;
}

/* 操作按钮行 */
.pos-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}
.pos-checkout-btn {
    flex: 1;
}

/* 响应式：窄屏时购物车变窄 */
@media (max-width: 960px) {
    .pos-body { flex-direction: column; }
    .pos-cart { width: 100%; }
}
</style>