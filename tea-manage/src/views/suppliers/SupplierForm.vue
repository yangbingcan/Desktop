<!--
  @file 供应商表单页面
  @description 新增/编辑供应商档案
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            去除散落 margin，区块间距由 n-space 统一控制；保留校验与提交逻辑。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-truck-delivery text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">
                        {{ isEdit ? '编辑供应商' : '新增供应商' }}
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
                    require-mark-placement="right-hanging"
                >
                    <n-form-item label="供应商名称" path="name">
                        <n-input
                            v-model:value="form.name"
                            placeholder="请输入供应商名称"
                            style="width: 400px"
                            maxlength="50"
                            show-count
                        />
                    </n-form-item>

                    <n-form-item label="联系人" path="contactPerson">
                        <n-input
                            v-model:value="form.contactPerson"
                            placeholder="请输入业务联系人姓名"
                            style="width: 300px"
                            maxlength="20"
                        />
                    </n-form-item>

                    <n-form-item label="联系电话" path="contactPhone">
                        <n-input
                            v-model:value="form.contactPhone"
                            placeholder="请输入联系电话"
                            style="width: 300px"
                        />
                    </n-form-item>

                    <n-form-item label="地址" path="address">
                        <n-input
                            v-model:value="form.address"
                            placeholder="请输入供应商经营地址"
                            style="width: 500px"
                            maxlength="100"
                        />
                    </n-form-item>

                    <n-form-item label="主营品类" path="mainCategories">
                        <n-select
                            v-model:value="form.mainCategories"
                            :options="categoryOptions"
                            multiple
                            filterable
                            tag
                            placeholder="可多选/自定义"
                            style="width: 500px"
                        />
                    </n-form-item>

                    <n-form-item label="备注" path="remark">
                        <n-input
                            v-model:value="form.remark"
                            type="textarea"
                            placeholder="可填写其他需要说明的信息"
                            :autosize="{ minRows: 2, maxRows: 4 }"
                            style="width: 500px"
                            maxlength="200"
                        />
                    </n-form-item>

                    <n-divider />
                    <n-space :size="12">
                        <n-button type="primary" :loading="saving" size="large" @click="handleSubmit">
                            保存
                        </n-button>
                        <n-button size="large" @click="$router.back()">取消</n-button>
                    </n-space>
                </n-form>
            </n-card>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 供应商表单逻辑
 * - 新增 / 编辑两种模式
 * - 提交前校验
 * - 编辑模式下加载现有数据
 */
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    NForm, NFormItem, NInput, NButton, NSelect, NCard,
    useMessage, type FormInst, type FormRules
} from 'naive-ui'
import { useSupplierStore } from '@/stores'
import type { SupplierInput } from '@/types'
import {
    validateSupplierName, validatePhone, TEA_CATEGORY_OPTIONS
} from '@/api/suppliers'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const supplierStore = useSupplierStore()

const formRef = ref<FormInst | null>(null)
const saving = ref(false)

/** 是否编辑模式 */
const isEdit = computed(() => route.name === 'SupplierEdit')
const editId = computed(() => route.params.id as string | undefined)

const form = reactive<SupplierInput>({
    name: '',
    contactPerson: '',
    contactPhone: '',
    address: '',
    mainCategories: [],
    remark: ''
})

/** 主营品类下拉选项 */
const categoryOptions = TEA_CATEGORY_OPTIONS.map(c => ({ label: c, value: c }))

/** 表单校验规则 */
const rules: FormRules = {
    name: [
        { required: true, validator: (_rule, value) => {
            return validateSupplierName(value || '') === null
                ? true : new Error(validateSupplierName(value || '')!)
        }, trigger: ['blur', 'input'] }
    ],
    contactPhone: [
        { validator: (_rule, value) => {
            if (!value) return true
            return validatePhone(value) === null
                ? true : new Error(validatePhone(value)!)
        }, trigger: ['blur', 'input'] }
    ]
}

/** 加载编辑数据 */
async function loadEditData() {
    if (!isEdit.value || !editId.value) return
    try {
        const data = await supplierStore.loadSupplier(editId.value)
        form.name = data.name
        form.contactPerson = data.contactPerson || ''
        form.contactPhone = data.contactPhone || ''
        form.address = data.address || ''
        form.mainCategories = [...data.mainCategories]
        form.remark = data.remark
    } catch (e: any) {
        message.error(`加载供应商失败: ${e}`)
        router.back()
    }
}

async function handleSubmit(e: MouseEvent) {
    e.preventDefault()
    if (!formRef.value) return

    try {
        await formRef.value.validate()
    } catch {
        message.warning('请检查表单填写')
        return
    }

    saving.value = true
    try {
        // 清理空白字段
        const input: SupplierInput = {
            name: form.name.trim(),
            contactPerson: form.contactPerson?.trim() || undefined,
            contactPhone: form.contactPhone?.trim() || undefined,
            address: form.address?.trim() || undefined,
            mainCategories: form.mainCategories,
            remark: form.remark?.trim() || undefined
        }

        if (isEdit.value && editId.value) {
            await supplierStore.updateSupplierById(editId.value, input)
            message.success('更新成功')
        } else {
            await supplierStore.addSupplier(input)
            message.success('新增成功')
        }
        router.push('/suppliers')
    } catch (e: any) {
        message.error(`保存失败: ${e}`)
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    loadEditData()
})
</script>

<style scoped>
/* 页面统一由 n-space 控制区块间距，关闭 .tea-page 全局卡片 margin，避免双重间距 */
.tea-page :deep(.n-card) {
    margin-bottom: 0 !important;
}
.tea-page :deep(.n-card + .n-card) {
    margin-top: 0 !important;
}
</style>
