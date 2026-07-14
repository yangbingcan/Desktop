<!--
  @file 会员表单页面
  @description 新增/编辑会员
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            去除散落 margin，区块间距由 n-space 统一控制；完整保留字段与校验。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 返回 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-account-edit text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">
                        {{ isEdit ? '编辑会员' : '新增会员' }}
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
                    <n-form-item label="姓名" path="name">
                        <n-input v-model:value="form.name" placeholder="请输入姓名" />
                    </n-form-item>

                    <n-form-item label="手机号" path="phone">
                        <n-input v-model:value="form.phone" placeholder="请输入手机号" />
                    </n-form-item>

                    <n-form-item label="性别" path="gender">
                        <n-radio-group v-model:value="form.gender">
                            <n-space :size="16">
                                <n-radio value="male">男</n-radio>
                                <n-radio value="female">女</n-radio>
                            </n-space>
                        </n-radio-group>
                    </n-form-item>

                    <n-form-item label="生日">
                        <n-date-picker v-model:value="form.birthday" type="date" style="width: 100%" />
                    </n-form-item>

                    <n-form-item label="会员等级" path="level">
                        <n-select
                            v-model:value="form.level"
                            :options="levelOptions"
                            placeholder="请选择等级"
                        />
                    </n-form-item>

                    <n-divider title="口味偏好" />

                    <n-form-item label="偏好茶类">
                        <n-checkbox-group v-model:value="form.preferences.preferredTeas">
                            <n-space>
                                <n-checkbox v-for="opt in TEA_TYPE_OPTIONS" :key="opt" :value="opt">{{ opt }}</n-checkbox>
                            </n-space>
                        </n-checkbox-group>
                    </n-form-item>

                    <n-form-item label="口感倾向">
                        <n-checkbox-group v-model:value="form.preferences.tastePreferences">
                            <n-space>
                                <n-checkbox v-for="opt in TASTE_OPTIONS" :key="opt" :value="opt">{{ opt }}</n-checkbox>
                            </n-space>
                        </n-checkbox-group>
                    </n-form-item>

                    <n-form-item label="禁忌/不喝">
                        <n-input
                            v-model:value="form.preferences.taboos"
                            type="textarea"
                            placeholder="如：不喝生普、怕失眠晚上不喝茶"
                        />
                    </n-form-item>

                    <n-form-item label="冲泡习惯">
                        <n-input
                            v-model:value="form.preferences.brewHabits"
                            type="textarea"
                            placeholder="如：喜欢100°C沸水、每次泡8g"
                        />
                    </n-form-item>

                    <n-form-item label="消费场景">
                        <n-checkbox-group v-model:value="form.preferences.consumptionScenario">
                            <n-space>
                                <n-checkbox v-for="opt in SCENARIO_OPTIONS" :key="opt" :value="opt">{{ opt }}</n-checkbox>
                            </n-space>
                        </n-checkbox-group>
                    </n-form-item>

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
/**
 * @file 会员表单页面
 * @description 新增/编辑会员
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import { createMember, updateMember, getMemberDetail, updateMemberPreference, TEA_TYPE_OPTIONS, TASTE_OPTIONS, SCENARIO_OPTIONS } from '@/api/members'

const router = useRouter()
const route = useRoute()
const message = useMessage()

const formRef = ref()
const saving = ref(false)
const isEdit = computed(() => !!route.params.id)

const form = reactive({
    name: '',
    phone: '',
    gender: 'male' as 'male' | 'female',
    birthday: null as number | null,
    level: 'normal',
    preferences: {
        preferredTeas: [] as string[],
        tastePreferences: [] as string[],
        taboos: '',
        brewHabits: '',
        consumptionScenario: [] as string[]
    }
})

const rules = {
    name: { required: true, message: '请输入姓名', trigger: 'blur' },
    phone: { required: true, message: '请输入手机号', trigger: 'blur' }
}

const levelOptions = [
    { label: '普通会员', value: 'normal' },
    { label: '银卡会员', value: 'silver' },
    { label: '金卡会员', value: 'gold' }
]

async function handleSubmit() {
    // 表单校验
    try {
        await formRef.value?.validate()
    } catch {
        return
    }

    saving.value = true
    try {
        // 将 birthday（时间戳）转为日期字符串
        const birthdayStr = form.birthday
            ? new Date(form.birthday).toISOString().slice(0, 10)
            : undefined
        const genderStr = form.gender || undefined

        if (isEdit.value) {
            // 编辑模式：更新会员基本信息
            const memberId = route.params.id as string
            await updateMember(memberId, form.name, form.phone, genderStr, birthdayStr)
            // 更新口味偏好
            await updateMemberPreference(memberId, {
                preferredTeas: form.preferences.preferredTeas,
                tastePreferences: form.preferences.tastePreferences,
                taboos: form.preferences.taboos,
                brewHabits: form.preferences.brewHabits,
                consumptionScenario: form.preferences.consumptionScenario,
                remark: ''
            })

            message.success('会员信息已更新')
        } else {
            // 新增模式：先创建会员，再保存口味偏好（C5 修复：原代码丢弃偏好）
            const created = await createMember(form.name, form.phone, genderStr, birthdayStr)
            await updateMemberPreference(created.id, {
                preferredTeas: form.preferences.preferredTeas,
                tastePreferences: form.preferences.tastePreferences,
                taboos: form.preferences.taboos,
                brewHabits: form.preferences.brewHabits,
                consumptionScenario: form.preferences.consumptionScenario,
                remark: ''
            })
            message.success('会员创建成功')
        }

        router.push('/members')
    } catch (error) {
        message.error(String(error ?? '保存失败'))
    } finally {
        saving.value = false
    }
}

// 编辑模式下加载会员数据
onMounted(async () => {
    if (isEdit.value) {
        try {
            const memberId = route.params.id as string
            const detail = await getMemberDetail(memberId)
            form.name = detail.member.name
            form.phone = detail.member.phone
            form.gender = (detail.member.gender as 'male' | 'female') || 'male'
            form.level = detail.member.level

            if (detail.member.birthday) {
                form.birthday = new Date(detail.member.birthday).getTime()
            }

            if (detail.preference) {
                form.preferences.preferredTeas = detail.preference.preferredTeas
                form.preferences.tastePreferences = detail.preference.tastePreferences
                form.preferences.taboos = detail.preference.taboos
                form.preferences.brewHabits = detail.preference.brewHabits
                form.preferences.consumptionScenario = detail.preference.consumptionScenario
            }
        } catch (error) {
            message.error('加载会员信息失败：' + String(error ?? ''))
        }
    }
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
