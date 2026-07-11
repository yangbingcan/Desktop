/**
 * @file 商品状态管理
 * @description 管理商品列表、新增、编辑、删除等状态，调用 api/products 层
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product, ProductCategory, SalesUnit, ProductCreateInput, ProductUpdateInput } from '@/types'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, getProductUnits } from '@/api/products'

export const useProductStore = defineStore('products', () => {
    // ========== 状态 ==========
    const products = ref<Product[]>([])
    const categories = ref<ProductCategory[]>([])
    const loading = ref(false)
    const currentProduct = ref<Product | null>(null)

    // ========== 计算属性 ==========
    const productMap = computed(() => {
        return new Map(products.value.map(p => [p.id, p]))
    })

    const weightProducts = computed(() => {
        return products.value.filter(p => p.type === 'weight')
    })

    const countProducts = computed(() => {
        return products.value.filter(p => p.type === 'count')
    })

    // 一级分类
    const topCategories = computed(() => {
        return categories.value.filter(c => c.level === 1)
    })

    // ========== Actions ==========
    async function loadProducts() {
        loading.value = true
        try {
            products.value = await getProducts()
        } catch (e) {
            // 🔧 v0.3.2 修复：暴露具体错误，便于排查
            console.error('加载商品列表失败:', e)
            throw e // 继续向上抛，让调用方（如 onMounted）显示具体错误
        } finally {
            loading.value = false
        }
    }

    async function loadCategories() {
        try {
            categories.value = await getCategories()
        } catch (e) {
            console.error('加载商品分类失败:', e)
            throw e
        }
    }

    async function addProduct(product: ProductCreateInput): Promise<Product> {
        const created = await createProduct(product)
        products.value.push(created)
        return created
    }

    async function updateProductById(id: string, product: ProductUpdateInput): Promise<Product> {
        const updated = await updateProduct(id, product)
        const index = products.value.findIndex(p => p.id === id)
        if (index !== -1) {
            products.value[index] = updated
        }
        return updated
    }

    async function deleteProductById(id: string) {
        await deleteProduct(id)
        products.value = products.value.filter(p => p.id !== id)
    }

    async function loadProductUnits(productId: string): Promise<SalesUnit[]> {
        return await getProductUnits(productId)
    }

    return {
        // 状态
        products,
        categories,
        loading,
        currentProduct,
        // 计算属性
        productMap,
        weightProducts,
        countProducts,
        topCategories,
        // 方法
        loadProducts,
        loadCategories,
        addProduct,
        updateProductById,
        deleteProductById,
        loadProductUnits
    }
})
