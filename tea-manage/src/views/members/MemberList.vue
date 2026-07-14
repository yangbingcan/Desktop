<!--
  @file 会员列表页面
  @description 会员档案管理 - 搜索筛选+表格+抽屉查看详情，参照 ProductList 紧凑设计
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            去除散落 margin、金额等宽 + 状态色走 NText type。
  @change v0.5.5 修复：原 <n-table> 不支持 columns/data props 导致数据不显示，改为 <n-data-table>
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 顶部操作栏 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-account-group-outline text-[18px] align-middle text-tea-primary" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">会员管理</span>
                </div>
                <n-button type="primary" @click="$router.push('/members/new')">
                    <template #icon>
                        <span class="i-mdi-plus align-middle" />
                    </template>
                    新增会员
                </n-button>
            </div>

            <!-- 筛选栏 -->
            <n-card :bordered="false" class="filter-card">
                <n-space align="center" :wrap="true" :size="[12, 8]">
                    <n-input
                        v-model:value="filters.keyword"
                        placeholder="搜索姓名/手机号"
                        clearable
                        style="width: 240px"
                        @keyup.enter="handleSearch"
                    >
                        <template #prefix>
                            <span class="i-mdi-magnify align-middle" />
                        </template>
                    </n-input>
                    <n-select
                        v-model:value="filters.level"
                        :options="levelOptions"
                        clearable
                        placeholder="会员等级"
                        style="width: 160px"
                    />
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
                    <span class="text-[12px] text-[var(--tea-content-3)]">共 {{ members.length }} 位会员</span>
                </template>
                <n-data-table
                    :columns="columns"
                    :data="members"
                    :loading="loading"
                    :row-key="(row: Member) => row.id"
                    :max-height="tableMaxHeight"
                    size="small"
                    striped
                    :flex-height="false"
                />
                <n-empty v-if="!loading && members.length === 0" description="暂无会员数据" class="py-12">
                    <template #extra>
                        <n-button size="small" @click="$router.push('/members/new')">
                            添加第一个会员
                        </n-button>
                    </template>
                </n-empty>
            </n-card>

            <!-- 会员快捷查看抽屉 -->
            <n-drawer v-model:show="drawerVisible" :width="520" placement="right">
                <n-drawer-content :body-style="{ padding: '24px' }">
                    <template #header>
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-2">
                                <span class="i-mdi-account-circle text-[16px] align-middle text-tea-primary" />
                                <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">
                                    {{ drawerMember ? `会员 - ${drawerMember.name}` : '会员详情' }}
                                </span>
                            </div>
                            <n-button
                                v-if="drawerMember"
                                size="small"
                                type="primary"
                                ghost
                                @click="goEdit(drawerMember.id)"
                            >
                                <template #icon>
                                    <span class="i-mdi-pencil align-middle" />
                                </template>
                                编辑
                            </n-button>
                        </div>
                    </template>

                    <template v-if="drawerMember">
                        <n-descriptions :column="2" bordered size="small" label-placement="left">
                            <n-descriptions-item label="姓名">
                                {{ drawerMember.name }}
                            </n-descriptions-item>
                            <n-descriptions-item label="手机号">
                                {{ drawerMember.phone }}
                            </n-descriptions-item>
                            <n-descriptions-item label="性别">
                                {{ drawerMember.gender === 'male' ? '男' : drawerMember.gender === 'female' ? '女' : (drawerMember.gender || '-') }}
                            </n-descriptions-item>
                            <n-descriptions-item label="生日">
                                {{ drawerMember.birthday || '-' }}
                            </n-descriptions-item>
                            <n-descriptions-item label="会员等级">
                                <n-tag size="small" :bordered="false" :type="getLevelType(drawerMember.level)">
                                    {{ getLevelLabel(drawerMember.level) }}
                                </n-tag>
                            </n-descriptions-item>
                            <n-descriptions-item label="折扣率">
                                {{ getDiscountLabel(drawerMember.level) }}
                            </n-descriptions-item>
                            <n-descriptions-item label="积分">
                                {{ drawerMember.points }}
                            </n-descriptions-item>
                            <n-descriptions-item label="储值余额">
                                <n-text type="warning" class="font-mono">{{ '¥' + drawerMember.balance.toFixed(2) }}</n-text>
                            </n-descriptions-item>
                            <n-descriptions-item label="累计消费">
                                <n-text type="success" class="font-mono">{{ '¥' + drawerMember.totalConsume.toFixed(2) }}</n-text>
                            </n-descriptions-item>
                            <n-descriptions-item label="消费次数">
                                {{ drawerMember.consumeCount }} 次
                            </n-descriptions-item>
                            <n-descriptions-item label="最后到店">
                                {{ drawerMember.lastVisit || '-' }}
                            </n-descriptions-item>
                            <n-descriptions-item label="注册时间">
                                {{ drawerMember.createdAt }}
                            </n-descriptions-item>
                        </n-descriptions>
                    </template>
                </n-drawer-content>
            </n-drawer>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 会员列表页面
 * @description 会员档案管理 - 搜索筛选+表格+抽屉查看详情
 * @change v0.5.5 修复 <n-table> 不支持 columns/data 的问题
 * @refactor v0.6.0 去除 vicons、金额/状态色改为 NText type
 */
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
    NButton, NTag, NSpace, NText,
    NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem
} from 'naive-ui'
import { useMemberStore } from '@/stores'
import type { Member, MemberLevel } from '@/types'
import { getMemberDiscountRate } from '@/api/members'

const router = useRouter()
const memberStore = useMemberStore()

const loading = ref(false)
const members = ref<Member[]>([])

const filters = reactive({
    keyword: '',
    level: null as string | null
})

const levelOptions = [
    { label: '普通', value: 'normal' },
    { label: '银卡', value: 'silver' },
    { label: '金卡', value: 'gold' }
]

// ========== 抽屉状态 ==========
const drawerVisible = ref(false)
const drawerMember = ref<Member | null>(null)

function openDrawer(member: Member) {
    drawerMember.value = member
    drawerVisible.value = true
}

function goEdit(id: string) {
    drawerVisible.value = false
    router.push(`/members/${id}/edit`)
}

function getLevelType(level: string): 'warning' | 'info' | 'default' {
    switch (level) {
        case 'gold': return 'warning'
        case 'silver': return 'info'
        default: return 'default'
    }
}

function getLevelLabel(level: string): string {
    switch (level) {
        case 'gold': return '金卡'
        case 'silver': return '银卡'
        default: return '普通'
    }
}

function getDiscountLabel(level: MemberLevel): string {
    const rate = getMemberDiscountRate(level)
    if (rate >= 1) return '无折扣'
    const zhe = rate * 10
    const text = Number.isInteger(zhe) ? zhe.toString() : zhe.toFixed(1)
    return `${text}折`
}

/** 表格最大高度 - 自适应屏幕 */
const tableMaxHeight = computed(() => {
    return Math.max(420, window.innerHeight - 280)
})

/** 表格列 - 参照 ProductList 紧凑设计 */
const columns = [
    {
        title: '姓名',
        key: 'name',
        width: 120,
        resizable: true,
        minWidth: 100,
        render(row: Member) {
            return h(NText, { depth: 1, strong: true }, { default: () => row.name })
        }
    },
    {
        title: '手机号',
        key: 'phone',
        width: 140,
        resizable: true,
        minWidth: 120,
        render(row: Member) {
            return h(NText, { depth: 2 }, { default: () => row.phone })
        }
    },
    {
        title: '等级',
        key: 'level',
        width: 90,
        resizable: true,
        minWidth: 80,
        render(row: Member) {
            return h(NTag, {
                size: 'small',
                bordered: false,
                type: getLevelType(row.level)
            }, { default: () => getLevelLabel(row.level) })
        }
    },
    {
        title: '折扣率',
        key: 'discountRate',
        width: 90,
        resizable: true,
        minWidth: 80,
        align: 'center',
        render(row: Member) {
            return h(NText, { depth: 3 }, { default: () => getDiscountLabel(row.level) })
        }
    },
    {
        title: '积分',
        key: 'points',
        width: 100,
        resizable: true,
        minWidth: 80,
        align: 'right',
        render(row: Member) {
            return h(NText, { depth: 2, strong: true }, { default: () => String(row.points) })
        }
    },
    {
        title: '储值余额',
        key: 'balance',
        width: 120,
        resizable: true,
        minWidth: 100,
        align: 'right',
        render(row: Member) {
            return h(NText, { type: 'warning', class: 'font-mono' }, { default: () => '¥' + row.balance.toFixed(2) })
        }
    },
    {
        title: '累计消费',
        key: 'totalConsume',
        width: 120,
        resizable: true,
        minWidth: 100,
        align: 'right',
        render(row: Member) {
            return h(NText, { type: 'success', class: 'font-mono' }, { default: () => '¥' + row.totalConsume.toFixed(2) })
        }
    },
    {
        title: '消费次数',
        key: 'consumeCount',
        width: 100,
        resizable: true,
        minWidth: 80,
        align: 'center',
        render(row: Member) {
            return h(NText, { depth: 2 }, { default: () => `${row.consumeCount} 次` })
        }
    },
    {
        title: '最后到店',
        key: 'lastVisit',
        width: 150,
        resizable: true,
        minWidth: 120,
        render(row: Member) {
            return h(NText, { depth: 3, class: 'text-[11px]' }, { default: () => (row.lastVisit || '-').slice(0, 16).replace('T', ' ') })
        }
    },
    {
        title: '注册时间',
        key: 'createdAt',
        width: 150,
        resizable: true,
        minWidth: 120,
        render(row: Member) {
            return h(NText, { depth: 3, class: 'text-[11px]' }, { default: () => (row.createdAt || '').slice(0, 16).replace('T', ' ') })
        }
    },
    {
        title: '操作',
        key: 'actions',
        width: 200,
        fixed: 'right',
        render(row: Member) {
            return h(NSpace, { size: 'small' }, {
                default: () => [
                    h(NButton, {
                        size: 'small',
                        type: 'primary',
                        text: true,
                        class: 'tea-btn-text',
                        onClick: () => openDrawer(row)
                    }, { default: () => '查看' }),
                    h(NButton, {
                        size: 'small',
                        type: 'primary',
                        ghost: true,
                        onClick: () => router.push(`/members/${row.id}`)
                    }, { default: () => '详情' }),
                    h(NButton, {
                        size: 'small',
                        type: 'primary',
                        ghost: true,
                        onClick: () => router.push(`/members/${row.id}/edit`)
                    }, { default: () => '编辑' })
                ]
            })
        }
    }
]

async function loadMembers() {
    loading.value = true
    try {
        await memberStore.loadMembers()
        members.value = memberStore.members
    } finally {
        loading.value = false
    }
}

async function handleSearch() {
    loading.value = true
    try {
        await memberStore.loadMembers(undefined, undefined, filters.keyword || undefined)
        let list = memberStore.members
        if (filters.level) {
            list = list.filter(m => m.level === filters.level)
        }
        members.value = list
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadMembers()
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
