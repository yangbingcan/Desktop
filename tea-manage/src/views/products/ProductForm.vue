/**
 * @file 商品表单页面
 * @description 新增 / 编辑商品
 * @refactor v0.6.0 统一深茶绿主题（n-config-provider themeOverrides）、
 *           Naive UI 组件化（n-card / n-space）、mdi 图标、
 *           去除散落 margin，区块间距由 n-space 统一控制。
 */
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-leaf text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">
                        {{ isEdit ? '编辑商品' : '新增商品' }}
                    </span>
                </div>
                <n-button @click="$router.back()">
                    <template #icon>
                        <span class="i-mdi-arrow-left align-middle" />
                    </template>
                    返回
                </n-button>
            </div>

            <n-card :bordered="false">
                <n-form
                    ref="formRef"
                    :model="form"
                    :rules="rules"
                    label-placement="left"
                    label-width="100"
                >
                    <!-- 基本信息 -->
                    <n-divider title="基本信息" />

                    <n-form-item label="商品名称" path="name">
                        <n-input v-model:value="form.name" placeholder="请输入商品名称" />
                    </n-form-item>

                    <n-form-item label="商品分类" path="categoryId">
                        <n-select
                            v-model:value="form.categoryId"
                            :options="categoryOptions"
                            placeholder="请选择分类"
                        />
                    </n-form-item>

                    <n-form-item label="商品类型" path="type">
                        <n-radio-group
                            v-model:value="form.type"
                            @update:value="onTypeChange"
                        >
                            <n-space :size="16">
                                <n-radio value="weight">称重类</n-radio>
                                <n-radio value="count">计件类</n-radio>
                            </n-space>
                        </n-radio-group>
                    </n-form-item>

                    <!-- 详细信息 -->
                    <n-divider title="详细信息" />

                    <n-form-item label="产地">
                        <n-input v-model:value="form.origin" placeholder="请输入产地" />
                    </n-form-item>

                    <n-form-item label="年份">
                        <n-input v-model:value="form.year" placeholder="如：2023春" />
                    </n-form-item>

                    <n-form-item label="等级">
                        <n-input v-model:value="form.grade" placeholder="如：特级、一级" />
                    </n-form-item>

                    <n-form-item label="发酵程度">
                        <n-select
                            v-model:value="form.fermentationLevel"
                            :options="fermentationOptions"
                            placeholder="请选择发酵程度"
                            clearable
                        />
                    </n-form-item>

                    <n-form-item label="焙火程度">
                        <n-select
                            v-model:value="form.roastLevel"
                            :options="roastOptions"
                            placeholder="请选择焙火程度"
                            clearable
                        />
                    </n-form-item>

                    <!-- 销售单位 -->
                    <n-divider title="销售单位与价格" />

                    <n-space vertical :size="12">
                        <div v-for="(unit, index) in form.units" :key="index">
                            <n-form-item :label="`单位 ${index + 1}`">
                                <div class="flex flex-wrap items-center gap-2">
                                    <n-input v-model:value="unit.name" placeholder="单位名称" style="width: 100px" />
                                    <span class="text-[var(--tea-content-3)]">换算</span>
                                    <n-input-number v-model:value="unit.conversionToBase" :min="1" style="width: 100px" />
                                    <span class="text-[var(--tea-content-3)]">{{ baseUnitDisplay }}</span>
                                    <span class="text-[var(--tea-content-3)]">零售价</span>
                                    <n-input-number v-model:value="unit.retailPrice" :min="0" :precision="2" style="width: 110px" />
                                    <span class="text-[var(--tea-content-3)]">会员价</span>
                                    <n-input-number v-model:value="unit.memberPrice" :min="0" :precision="2" style="width: 110px" />
                                    <n-button circle type="error" @click="removeUnit(index)">
                                        <template #icon>
                                            <span class="i-mdi-delete align-middle" />
                                        </template>
                                    </n-button>
                                </div>
                            </n-form-item>
                        </div>
                    </n-space>

                    <n-button type="primary" dashed @click="addUnit">
                        <template #icon>
                            <span class="i-mdi-plus align-middle" />
                        </template>
                        添加单位
                    </n-button>

                    <!-- 提交按钮 -->
                    <n-divider />
                    <n-space :size="12">
                        <n-button type="primary" :loading="saving" @click="handleSubmit">
                            {{ isEdit ? '保存' : '创建' }}
                        </n-button>
                        <n-button @click="$router.back()">取消</n-button>
                    </n-space>
                </n-form>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProductStore } from '@/stores'
import { getProduct, createProduct, updateProduct, getProductUnits } from '@/api/products'
import type { SalesUnitInput } from '@/types'
import type { ProductType, BaseUnit } from '@/types'
import { useMessage } from 'naive-ui'

const message = useMessage()
const router = useRouter()
const route = useRoute()
const productStore = useProductStore()

const formRef = ref()
const saving = ref(false)
const loadingDetail = ref(false)
const isEdit = computed(() => !!route.params.id)
const productId = computed(() => route.params.id as string)

// 表单数据
const form = reactive({
    name: '',
    categoryId: '',
    type: 'weight' as ProductType,
    baseUnit: 'g' as BaseUnit,
    origin: '',
    year: '',
    grade: '',
    fermentationLevel: '',
    roastLevel: '',
    units: [] as Array<{
        name: string
        conversionToBase: number
        retailPrice: number
        memberPrice: number
    }>
})

const rules = {
    name: { required: true, message: '请输入商品名称', trigger: 'blur' },
    categoryId: { required: true, message: '请选择分类', trigger: 'change' },
    type: { required: true, message: '请选择商品类型', trigger: 'change' }
}

// 分类选项
const categoryOptions = computed(() => {
    return productStore.categories.map(c => ({ label: c.name, value: c.id }))
})

// 基准单位显示
const baseUnitDisplay = computed(() => {
    return form.type === 'weight' ? '克(g)' : '个(pcs)'
})

// 根据类型更新基准单位
function onTypeChange(type: ProductType) {
    form.type = type
    form.baseUnit = type === 'weight' ? 'g' : 'pcs'
    // 清空单位，重新添加默认单位
    form.units = [createDefaultUnit()]
}

const fermentationOptions = [
    { label: '不发酵', value: 'none' },
    { label: '轻发酵', value: 'light' },
    { label: '半发酵', value: 'half' },
    { label: '全发酵', value: 'full' }
]

const roastOptions = [
    { label: '轻火', value: 'light' },
    { label: '中火', value: 'medium' },
    { label: '足火', value: 'full' },
    { label: '重火', value: 'heavy' }
]

function createDefaultUnit() {
    return {
        name: form.type === 'weight' ? '50克' : '1个',
        conversionToBase: 1,
        retailPrice: 0,
        memberPrice: 0
    }
}

function addUnit() {
    form.units.push(createDefaultUnit())
}

function removeUnit(index: number) {
    form.units.splice(index, 1)
}

async function handleSubmit() {
    saving.value = true
    try {
        await formRef.value?.validate()

        // 构建销售单位输入（camelCase，匹配后端 rename_all = "camelCase"）
        const unitsInput: SalesUnitInput[] = form.units.map(u => ({
            name: u.name,
            conversionToBase: u.conversionToBase,
            retailPrice: u.retailPrice,
            memberPrice: u.memberPrice
        }))

        if (isEdit.value) {
            // 更新商品
            await updateProduct(productId.value, {
                name: form.name,
                categoryId: form.categoryId || null,
                type: form.type,
                baseUnit: form.baseUnit,
                origin: form.origin || undefined,
                year: form.year || undefined,
                grade: form.grade || undefined,
                fermentationLevel: form.fermentationLevel || undefined,
                roastLevel: form.roastLevel || undefined,
                units: unitsInput
            })
            message.success('商品更新成功')
        } else {
            // 创建商品
            await createProduct({
                name: form.name,
                categoryId: form.categoryId || null,
                type: form.type,
                origin: form.origin || undefined,
                year: form.year || undefined,
                grade: form.grade || undefined,
                fermentationLevel: form.fermentationLevel || undefined,
                roastLevel: form.roastLevel || undefined,
                units: unitsInput
            })
            message.success('商品创建成功')
        }
        router.push('/products')
    } catch (error) {
        console.error('保存失败:', error)
        message.error('保存失败')
    } finally {
        saving.value = false
    }
}

async function loadProductDetail() {
    if (!isEdit.value) return

    loadingDetail.value = true
    try {
        const detail = await getProduct(productId.value)
        if (detail) {
            form.name = detail.name
            form.categoryId = detail.categoryId || ''
            form.type = detail.type
            form.baseUnit = detail.baseUnit
            form.origin = detail.origin || ''
            form.year = detail.year || ''
            form.grade = detail.grade || ''
            form.fermentationLevel = detail.fermentationLevel || ''
            form.roastLevel = detail.roastLevel || ''

            // 加载销售单位
            const units = await getProductUnits(productId.value)
            if (units.length > 0) {
                form.units = units.map(u => ({
                    name: u.name,
                    conversionToBase: u.conversionToBase,
                    retailPrice: u.retailPrice,
                    memberPrice: u.memberPrice
                }))
            }
        }
    } catch (error) {
        console.error('加载商品详情失败:', error)
        message.error('加载商品详情失败')
    } finally {
        loadingDetail.value = false
    }
}

onMounted(async () => {
    await productStore.loadCategories()
    if (isEdit.value) {
        await loadProductDetail()
    } else {
        // 新增时添加一个默认单位
        form.units = [createDefaultUnit()]
    }
})
</script>
