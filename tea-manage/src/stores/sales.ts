/**
 * @file 销售状态管理
 * @description 管理收银、销售单据等状态，调用 api/sales 层
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SaleOrder, CartItem, PayMethod, SaleOrderInput, SaleItemInput } from '@/types'
import { createSaleOrder, holdOrder, getHeldOrders, getHeldOrderDetail, deleteHeldOrder } from '@/api/sales'
import type { HeldOrder } from '@/types'

export const useSalesStore = defineStore('sales', () => {
    // ========== 状态 ==========
    const cartItems = ref<CartItem[]>([])
    const currentMemberId = ref<string | null>(null)
    const currentOrder = ref<SaleOrder | null>(null)
    const heldOrderList = ref<HeldOrder[]>([])
    const loading = ref(false)

    // ========== 计算属性 ==========
    const totalAmount = computed(() => {
        return cartItems.value.reduce((sum, item) => sum + item.subtotal, 0)
    })

    const totalItems = computed(() => {
        return cartItems.value.reduce((sum, item) => sum + item.quantity, 0)
    })

    // ========== Actions ==========
    function addToCart(item: Omit<CartItem, 'subtotal'>) {
        const existing = cartItems.value.find(
            c => c.productId === item.productId && c.unitId === item.unitId
        )
        if (existing) {
            existing.quantity += item.quantity
            existing.subtotal = existing.quantity * existing.price
        } else {
            cartItems.value.push({ ...item, subtotal: item.price * item.quantity })
        }
    }

    function updateCartItem(productId: string, unitId: string, quantity: number) {
        const item = cartItems.value.find(
            c => c.productId === productId && c.unitId === unitId
        )
        if (item) {
            item.quantity = quantity
            item.subtotal = item.price * quantity
        }
    }

    function removeFromCart(productId: string, unitId: string) {
        cartItems.value = cartItems.value.filter(
            c => !(c.productId === productId && c.unitId === unitId)
        )
    }

    function clearCart() {
        cartItems.value = []
        currentMemberId.value = null
    }

    /**
     * 结算（创建销售订单）
     */
    async function checkout(payMethod: PayMethod, remark?: string) {
        loading.value = true
        try {
            const input: SaleOrderInput = {
                items: cartItems.value.map((item): SaleItemInput => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity
                })),
                memberId: currentMemberId.value || undefined,
                payMethod,
                remark
            }
            const order = await createSaleOrder(input)
            currentOrder.value = order
            clearCart()
            return order
        } finally {
            loading.value = false
        }
    }

    /**
     * 挂单
     */
    async function doHoldOrder() {
        loading.value = true
        try {
            const input: SaleOrderInput = {
                items: cartItems.value.map((item): SaleItemInput => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity
                })),
                memberId: currentMemberId.value || undefined
            }
            await holdOrder(input)
            clearCart()
        } finally {
            loading.value = false
        }
    }

    /**
     * 获取挂起的订单列表
     */
    async function loadHeldOrders() {
        heldOrderList.value = await getHeldOrders()
    }

    /**
     * 取单（获取挂起订单详情）
     */
    async function resumeOrder(orderId: string): Promise<SaleOrder> {
        const order = await getHeldOrderDetail(orderId)
        // 从订单恢复购物车
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
        currentMemberId.value = order.memberId
        // 从列表中移除该挂单
        await deleteHeldOrder(orderId)
        heldOrderList.value = heldOrderList.value.filter(o => o.id !== orderId)
        return order
    }

    function setMember(memberId: string | null) {
        currentMemberId.value = memberId
    }

    return {
        cartItems,
        currentMemberId,
        currentOrder,
        heldOrderList,
        loading,
        totalAmount,
        totalItems,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        checkout,
        doHoldOrder,
        loadHeldOrders,
        resumeOrder,
        setMember
    }
})
