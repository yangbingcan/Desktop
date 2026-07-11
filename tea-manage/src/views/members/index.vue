<!--
  @file 会员列表页面
  @description 会员档案管理、口味偏好、消费记录
  @refactor v0.6.0 统一深茶绿主题（n-config-provider themeOverrides）、
            Naive UI 组件化（n-card / n-space / n-text）、mdi 图标、
            去除散落 margin、金额等宽 + 状态色走 NText type。
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 页面标题 + 主操作 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-account-group-outline text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">会员管理</span>
                </div>
                <n-button type="primary" @click="openAddMember">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增会员
                </n-button>
            </div>

            <!-- 筛选区 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-input
                        v-model:value="keyword"
                        placeholder="搜索姓名/手机号"
                        clearable
                        style="width: 260px"
                        @keyup.enter="handleSearch"
                    >
                        <template #prefix>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                    </n-input>
                    <n-button type="primary" @click="handleSearch">
                        <template #icon>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                        查询
                    </n-button>
                </n-space>
            </n-card>

            <!-- 会员表格 -->
            <n-card :bordered="false" title="会员列表" class="table-card">
                <template #header-extra>
                    <span class="text-[12px] text-[var(--tea-content-3)]">共 {{ memberList.length }} 位会员</span>
                </template>
                <n-data-table
                    :loading="loading"
                    :columns="columns"
                    :data="memberList"
                    :pagination="{
                        page: page,
                        pageSize: pageSize,
                        itemCount: total,
                        showSizePicker: false,
                        showQuickJumper: true
                    }"
                    :row-key="(row: Member) => row.id"
                    size="small"
                    striped
                    @update:page="handlePageChange"
                />
                <n-empty
                    v-if="!loading && memberList.length === 0"
                    description="暂无会员数据"
                    class="py-12"
                />
            </n-card>

            <!-- 会员详情弹窗 -->
            <n-modal
                v-model:show="detailVisible"
                preset="card"
                title="会员详情"
                style="width: 800px; max-width: 90vw;"
                :z-index="1000"
            >
                <n-spin :show="detailLoading">
                    <template v-if="memberDetail">
                        <n-space vertical :size="16">
                            <n-descriptions :column="2" bordered label-placement="left" size="small">
                                <n-descriptions-item label="姓名">
                                    {{ memberDetail.member.name }}
                                </n-descriptions-item>
                                <n-descriptions-item label="手机号">
                                    {{ memberDetail.member.phone }}
                                </n-descriptions-item>
                                <n-descriptions-item label="性别">
                                    {{ memberDetail.member.gender === 'male' ? '男' : memberDetail.member.gender === 'female' ? '女' : '-' }}
                                </n-descriptions-item>
                                <n-descriptions-item label="生日">
                                    {{ memberDetail.member.birthday || '-' }}
                                </n-descriptions-item>
                                <n-descriptions-item label="会员等级">
                                    <n-tag :type="memberDetail.member.level === 'gold' ? 'warning' : memberDetail.member.level === 'silver' ? 'info' : 'default'" size="small" :bordered="false">
                                        {{ getMemberLevelName(memberDetail.member.level) }}
                                    </n-tag>
                                    <n-text depth="3" class="ml-2 text-[13px]">({{ getMemberDiscountRate(memberDetail.member.level) * 100 }}折)</n-text>
                                </n-descriptions-item>
                                <n-descriptions-item label="累计消费">
                                    <n-text type="primary" class="font-mono">{{ '¥' + memberDetail.member.totalConsume.toFixed(2) }}</n-text>
                                </n-descriptions-item>
                                <n-descriptions-item label="积分余额">
                                    {{ memberDetail.member.points }}
                                </n-descriptions-item>
                                <n-descriptions-item label="储值余额">
                                    <n-text type="primary" class="font-mono">{{ '¥' + memberDetail.member.balance.toFixed(2) }}</n-text>
                                </n-descriptions-item>
                                <n-descriptions-item label="消费次数">
                                    {{ memberDetail.member.consumeCount }} 次
                                </n-descriptions-item>
                                <n-descriptions-item label="最后到店">
                                    {{ formatDate(memberDetail.member.lastVisit) }}
                                </n-descriptions-item>
                            </n-descriptions>

                            <n-tabs type="line">
                                <!-- 口味偏好 -->
                                <n-tab-pane name="preference" tab="口味偏好">
                                    <n-space vertical :size="12">
                                        <template v-if="memberDetail.preference">
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>偏好茶类：</n-text>
                                                <n-space :size="[8, 4]" :wrap="true">
                                                    <n-tag v-for="tea in memberDetail.preference.preferredTeas" :key="tea" size="small" :bordered="false" type="warning">{{ tea }}</n-tag>
                                                    <n-tag v-if="memberDetail.preference.preferredTeas.length === 0" size="small" type="default" :bordered="false">未设置</n-tag>
                                                </n-space>
                                            </div>
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>口感倾向：</n-text>
                                                <n-space :size="[8, 4]" :wrap="true">
                                                    <n-tag v-for="taste in memberDetail.preference.tastePreferences" :key="taste" size="small" :bordered="false">{{ taste }}</n-tag>
                                                    <n-tag v-if="memberDetail.preference.tastePreferences.length === 0" size="small" type="default" :bordered="false">未设置</n-tag>
                                                </n-space>
                                            </div>
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>禁忌：</n-text>
                                                <n-text depth="2">{{ memberDetail.preference.taboos || '无' }}</n-text>
                                            </div>
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>冲泡习惯：</n-text>
                                                <n-text depth="2">{{ memberDetail.preference.brewHabits || '未设置' }}</n-text>
                                            </div>
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>消费场景：</n-text>
                                                <n-space :size="[8, 4]" :wrap="true">
                                                    <n-tag v-for="scene in memberDetail.preference.consumptionScenario" :key="scene" size="small" :bordered="false" type="info">{{ scene }}</n-tag>
                                                    <n-tag v-if="memberDetail.preference.consumptionScenario.length === 0" size="small" type="default" :bordered="false">未设置</n-tag>
                                                </n-space>
                                            </div>
                                            <div class="flex items-start gap-2 flex-wrap">
                                                <n-text strong>备注：</n-text>
                                                <n-text depth="2">{{ memberDetail.preference.remark || '无' }}</n-text>
                                            </div>
                                        </template>
                                        <n-empty v-else description="暂无口味偏好信息" />
                                        <n-button size="small" @click="openPreferenceEdit">编辑偏好</n-button>
                                    </n-space>
                                </n-tab-pane>

                                <!-- 消费记录 -->
                                <n-tab-pane name="consumption" tab="消费记录">
                                    <n-space vertical :size="12">
                                        <n-data-table
                                            :columns="consumptionColumns"
                                            :data="consumptionTableData"
                                            :pagination="false"
                                            size="small"
                                            striped
                                        />
                                        <n-empty v-if="consumptionTableData.length === 0" description="暂无消费记录" />
                                    </n-space>
                                </n-tab-pane>
                            </n-tabs>
                        </n-space>
                    </template>
                </n-spin>

                <template #footer>
                    <n-space justify="end">
                        <n-button @click="closeDetail">关闭</n-button>
                    </n-space>
                </template>
            </n-modal>

            <!-- 新增/编辑会员弹窗 -->
            <n-modal
                v-model:show="memberFormVisible"
                preset="card"
                :title="isEdit ? '编辑会员' : '新增会员'"
                style="width: 400px"
                :z-index="1000"
            >
                <n-spin :show="memberFormLoading">
                    <n-form :model="memberForm" label-placement="left" label-width="80">
                        <n-form-item label="姓名" required>
                            <n-input v-model:value="memberForm.name" placeholder="请输入姓名" />
                        </n-form-item>
                        <n-form-item label="手机号" required>
                            <n-input v-model:value="memberForm.phone" placeholder="请输入手机号" />
                        </n-form-item>
                        <n-form-item label="性别">
                            <n-select
                                v-model:value="memberForm.gender"
                                :options="[
                                    { label: '男', value: 'male' },
                                    { label: '女', value: 'female' }
                                ]"
                                placeholder="请选择性别"
                                clearable
                            />
                        </n-form-item>
                        <n-form-item label="生日">
                            <n-date-picker
                                v-model:value="memberForm.birthday"
                                type="date"
                                placeholder="选择生日"
                                style="width: 100%"
                            />
                        </n-form-item>
                    </n-form>
                </n-spin>

                <template #footer>
                    <n-space justify="end">
                        <n-button @click="memberFormVisible = false">取消</n-button>
                        <n-button type="primary" :loading="memberFormLoading" @click="submitMemberForm">保存</n-button>
                    </n-space>
                </template>
            </n-modal>

            <!-- 口味偏好编辑弹窗 -->
            <n-modal
                v-model:show="preferenceFormVisible"
                preset="card"
                title="编辑口味偏好"
                style="width: 500px"
                :z-index="1000"
            >
                <n-spin :show="preferenceFormLoading">
                    <n-form :model="preferenceForm" label-placement="left" label-width="90">
                        <n-form-item label="偏好茶类">
                            <n-checkbox-group v-model:value="preferenceForm.preferredTeas">
                                <n-space>
                                    <n-checkbox v-for="tea in TEA_TYPE_OPTIONS" :key="tea" :value="tea" :label="tea" />
                                </n-space>
                            </n-checkbox-group>
                        </n-form-item>
                        <n-form-item label="口感倾向">
                            <n-checkbox-group v-model:value="preferenceForm.tastePreferences">
                                <n-space>
                                    <n-checkbox v-for="taste in TASTE_OPTIONS" :key="taste" :value="taste" :label="taste" />
                                </n-space>
                            </n-checkbox-group>
                        </n-form-item>
                        <n-form-item label="禁忌">
                            <n-input
                                v-model:value="preferenceForm.taboos"
                                type="textarea"
                                placeholder="不喝什么、过敏等"
                                :rows="2"
                            />
                        </n-form-item>
                        <n-form-item label="冲泡习惯">
                            <n-input
                                v-model:value="preferenceForm.brewHabits"
                                type="textarea"
                                placeholder="喜欢多少°C、每次泡多少g等"
                                :rows="2"
                            />
                        </n-form-item>
                        <n-form-item label="消费场景">
                            <n-checkbox-group v-model:value="preferenceForm.consumptionScenario">
                                <n-space>
                                    <n-checkbox v-for="scene in SCENARIO_OPTIONS" :key="scene" :value="scene" :label="scene" />
                                </n-space>
                            </n-checkbox-group>
                        </n-form-item>
                        <n-form-item label="备注">
                            <n-input
                                v-model:value="preferenceForm.remark"
                                type="textarea"
                                placeholder="其他备注"
                                :rows="2"
                            />
                        </n-form-item>
                    </n-form>
                </n-spin>

                <template #footer>
                    <n-space justify="end">
                        <n-button @click="preferenceFormVisible = false">取消</n-button>
                        <n-button type="primary" :loading="preferenceFormLoading" @click="submitPreference">保存</n-button>
                    </n-space>
                </template>
            </n-modal>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 会员列表页面
 * @description 会员档案管理、口味偏好、消费记录
 */
import { ref, computed, onMounted, h } from 'vue'
import { NButton, NSpace, NTag, NText } from 'naive-ui'
import { getMembers, createMember, updateMember, getMemberDetail, updateMemberPreference, getMemberConsumption, type Member, type MemberDetail, type MemberConsumption, type MemberPreferenceInput, getMemberLevelName, getMemberDiscountRate, TEA_TYPE_OPTIONS, TASTE_OPTIONS, SCENARIO_OPTIONS } from '@/api/members'
import type { MemberConsumptionItem } from '@/types'
import { useMessage } from 'naive-ui'

const message = useMessage()

const loading = ref(false)
const memberList = ref<Member[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')

// 详情弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const memberDetail = ref<MemberDetail | null>(null)
const memberConsumption = ref<MemberConsumption | null>(null)

// 新增/编辑会员弹窗
const memberFormVisible = ref(false)
const memberFormLoading = ref(false)
const memberForm = ref({
    name: '',
    phone: '',
    gender: null as string | null,
    birthday: null as number | null
})
const isEdit = ref(false)
const editingMemberId = ref('')

// 偏好编辑弹窗
const preferenceFormVisible = ref(false)
const preferenceFormLoading = ref(false)
const preferenceForm = ref<MemberPreferenceInput>({
    preferredTeas: [],
    tastePreferences: [],
    taboos: '',
    brewHabits: '',
    consumptionScenario: [],
    remark: ''
})

/** 表格列 */
const columns = [
    { title: '姓名', key: 'name', width: 100 },
    { title: '手机号', key: 'phone', width: 130 },
    {
        title: '等级',
        key: 'level',
        width: 80,
        render(row: Member) {
            const typeMap: Record<string, 'default' | 'info' | 'warning'> = {
                normal: 'default',
                silver: 'info',
                gold: 'warning'
            }
            return h(NTag, { type: typeMap[row.level] || 'default', size: 'small', bordered: false }, { default: () => getMemberLevelName(row.level) })
        }
    },
    {
        title: '累计消费',
        key: 'totalConsume',
        width: 100,
        render(row: Member) {
            return h(NText, { type: 'primary', class: 'font-mono' }, { default: () => '¥' + row.totalConsume.toFixed(2) })
        }
    },
    { title: '积分', key: 'points', width: 80 },
    {
        title: '储值',
        key: 'balance',
        width: 90,
        render(row: Member) {
            return h(NText, { type: 'primary', class: 'font-mono' }, { default: () => '¥' + row.balance.toFixed(2) })
        }
    },
    {
        title: '消费次数',
        key: 'consumeCount',
        width: 90
    },
    {
        title: '最后到店',
        key: 'lastVisit',
        width: 160,
        render(row: Member) {
            return h(NText, { depth: 3, class: 'text-[12px]' }, { default: () => formatDate(row.lastVisit) })
        }
    },
    {
        title: '操作',
        key: 'actions',
        width: 160,
        render(row: Member) {
            return h(NSpace, { size: 'small' }, {
                default: () => [
                    h(NButton, {
                        size: 'small',
                        onClick: () => showDetail(row)
                    }, { default: () => '详情' }),
                    h(NButton, {
                        size: 'small',
                        type: 'primary',
                        onClick: () => openEditMember(row)
                    }, { default: () => '编辑' })
                ]
            })
        }
    }
]

/** 加载会员列表 */
async function loadMembers() {
    loading.value = true
    try {
        const result = await getMembers(page.value, pageSize.value, keyword.value)
        memberList.value = result.list
        total.value = result.total
    } catch (error) {
        console.error('加载会员列表失败:', error)
        message.error('加载会员列表失败')
    } finally {
        loading.value = false
    }
}

/** 搜索 */
async function handleSearch() {
    page.value = 1
    await loadMembers()
}

/** 显示详情 */
async function showDetail(member: Member) {
    detailVisible.value = true
    detailLoading.value = true
    memberDetail.value = null
    memberConsumption.value = null
    try {
        memberDetail.value = await getMemberDetail(member.id)
        memberConsumption.value = await getMemberConsumption(member.id)
    } catch (error) {
        console.error('加载会员详情失败:', error)
        message.error('加载会员详情失败')
    } finally {
        detailLoading.value = false
    }
}

/** 关闭详情 */
function closeDetail() {
    detailVisible.value = false
    memberDetail.value = null
    memberConsumption.value = null
}

/** 打开新增会员弹窗 */
function openAddMember() {
    isEdit.value = false
    editingMemberId.value = ''
    memberForm.value = {
        name: '',
        phone: '',
        gender: null,
        birthday: null
    }
    memberFormVisible.value = true
}

/** 打开编辑会员弹窗 */
function openEditMember(member: Member) {
    isEdit.value = true
    editingMemberId.value = member.id
    memberForm.value = {
        name: member.name,
        phone: member.phone,
        gender: member.gender,
        birthday: member.birthday ? new Date(member.birthday).getTime() : null
    }
    memberFormVisible.value = true
}

/** 提交会员表单 */
async function submitMemberForm() {
    if (!memberForm.value.name.trim()) {
        message.warning('请输入姓名')
        return
    }
    if (!memberForm.value.phone.trim()) {
        message.warning('请输入手机号')
        return
    }
    if (!/^1[3-9]\d{9}$/.test(memberForm.value.phone)) {
        message.warning('请输入正确的手机号')
        return
    }

    memberFormLoading.value = true
    try {
        const birthday = memberForm.value.birthday
            ? new Date(memberForm.value.birthday).toISOString().split('T')[0]
            : undefined

        if (isEdit.value) {
            await updateMember(
                editingMemberId.value,
                memberForm.value.name.trim(),
                memberForm.value.phone.trim(),
                memberForm.value.gender || undefined,
                birthday
            )
            message.success('更新会员成功')
        } else {
            await createMember(
                memberForm.value.name.trim(),
                memberForm.value.phone.trim(),
                memberForm.value.gender || undefined,
                birthday
            )
            message.success('创建会员成功')
        }
        memberFormVisible.value = false
        loadMembers()
    } catch (error: any) {
        console.error('保存会员失败:', error)
        if (error.toString().includes('UNIQUE constraint failed')) {
            message.error('该手机号已存在')
        } else {
            message.error('保存会员失败')
        }
    } finally {
        memberFormLoading.value = false
    }
}

/** 打开偏好编辑 */
function openPreferenceEdit() {
    if (!memberDetail.value?.preference) {
        preferenceForm.value = {
            preferredTeas: [],
            tastePreferences: [],
            taboos: '',
            brewHabits: '',
            consumptionScenario: [],
            remark: ''
        }
    } else {
        preferenceForm.value = { ...memberDetail.value.preference }
    }
    preferenceFormVisible.value = true
}

/** 提交偏好 */
async function submitPreference() {
    if (!memberDetail.value) return

    preferenceFormLoading.value = true
    try {
        await updateMemberPreference(memberDetail.value.member.id, preferenceForm.value)
        message.success('保存偏好成功')
        preferenceFormVisible.value = false
        // 刷新详情
        memberDetail.value = await getMemberDetail(memberDetail.value.member.id)
    } catch (error) {
        console.error('保存偏好失败:', error)
        message.error('保存偏好失败')
    } finally {
        preferenceFormLoading.value = false
    }
}

/** 换页 */
function handlePageChange(newPage: number) {
    page.value = newPage
    loadMembers()
}

/** 格式化日期 */
function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
}

/** 消费记录表格列 */
const consumptionColumns = [
    { title: '订单号', key: 'orderNo', width: 150 },
    {
        title: '金额',
        key: 'totalAmount',
        width: 100,
        render(row: MemberConsumptionItem) {
            return h(NText, { type: 'primary', class: 'font-mono' }, { default: () => '¥' + row.totalAmount.toFixed(2) })
        }
    },
    {
        title: '获得积分',
        key: 'pointsEarned',
        width: 100,
        render(row: MemberConsumptionItem) {
            return h(NText, { type: 'success', class: 'font-mono' }, { default: () => '+' + row.pointsEarned })
        }
    },
    {
        title: '使用积分',
        key: 'pointsDeduct',
        width: 100,
        render(row: MemberConsumptionItem) {
            return h(NText, { type: 'error', class: 'font-mono' }, { default: () => row.pointsDeduct > 0 ? '-' + row.pointsDeduct : '0' })
        }
    },
    {
        title: '时间',
        key: 'createdAt',
        width: 160,
        render(row: MemberConsumptionItem) {
            return h(NText, { depth: 3, class: 'text-[12px]' }, { default: () => formatDate(row.createdAt) })
        }
    }
]

/** 消费记录数据 */
const consumptionTableData = computed(() => {
    return memberConsumption.value?.records || []
})

onMounted(async () => {
    await loadMembers()
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
