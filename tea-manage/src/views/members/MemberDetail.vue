<!--
  @file 会员详情页面
  @description 会员档案查看、积分/储值管理、消费记录、储值流水
  @refactor v0.6.0 统一深茶绿主题、Naive UI 组件化、mdi 图标、
            去除散落 margin、金额等宽 + 状态色走 NText type。
  @version v0.3.1
-->
<template>
    <div class="tea-page p-md">
        <n-space vertical :size="16">
            <!-- 标题栏 + 操作 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="i-mdi-account-circle text-[18px] align-middle text-[var(--tea-primary)]" />
                    <span class="text-[18px] font-semibold text-[var(--tea-content-1)]">会员详情</span>
                </div>
                <n-space :size="8">
                    <n-button @click="$router.push(`/members/${memberId}/edit`)">
                        <template #icon>
                            <span class="i-mdi-pencil align-middle" />
                        </template>
                        编辑
                    </n-button>
                    <n-button type="primary" @click="openRechargeModal">
                        <template #icon>
                            <span class="i-mdi-wallet align-middle" />
                        </template>
                        充值
                    </n-button>
                    <n-button
                        v-if="member && member.balance > 0"
                        type="warning"
                        @click="openRefundModal"
                    >
                        <template #icon>
                            <span class="i-mdi-undo-variant align-middle" />
                        </template>
                        退款
                    </n-button>
                </n-space>
            </div>

            <!-- 会员信息卡片 -->
            <n-card :bordered="false">
                <n-descriptions :column="3">
                    <n-descriptions-item label="姓名">{{ member?.name }}</n-descriptions-item>
                    <n-descriptions-item label="手机号">{{ member?.phone }}</n-descriptions-item>
                    <n-descriptions-item label="会员等级">
                        <n-tag :type="getLevelType(member?.level)">{{ getLevelName(member?.level) }}</n-tag>
                    </n-descriptions-item>
                    <n-descriptions-item label="折扣率">{{ member ? getMemberDiscountRate(member.level) : '-' }}</n-descriptions-item>
                    <n-descriptions-item label="积分">{{ member?.points }}</n-descriptions-item>
                    <n-descriptions-item label="储值余额">
                        <n-text type="warning" class="font-mono">{{ '¥' + ((member?.balance) || 0).toFixed(2) }}</n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="累计消费">
                        <n-text type="primary" class="font-mono">{{ '¥' + (member?.totalConsume || 0) }}</n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="到店次数">{{ member?.consumeCount }}次</n-descriptions-item>
                    <n-descriptions-item label="最后到店">{{ member?.lastVisit }}</n-descriptions-item>
                </n-descriptions>
            </n-card>

            <!-- 口味偏好 -->
            <n-card title="口味偏好" :bordered="false">
                <n-space vertical :size="12">
                    <div class="flex items-center gap-2 flex-wrap">
                        <n-text strong>偏好茶类：</n-text>
                        <n-space :size="[8, 4]" :wrap="true">
                            <n-tag v-for="tea in preferences?.preferredTeas" :key="tea" size="small" :bordered="false">{{ tea }}</n-tag>
                        </n-space>
                        <n-text v-if="!preferences?.preferredTeas?.length" depth="3">无</n-text>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <n-text strong>口感倾向：</n-text>
                        <n-space :size="[8, 4]" :wrap="true">
                            <n-tag v-for="taste in preferences?.tastePreferences" :key="taste" size="small" :bordered="false">{{ taste }}</n-tag>
                        </n-space>
                        <n-text v-if="!preferences?.tastePreferences?.length" depth="3">无</n-text>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <n-text strong>禁忌/不喝：</n-text>
                        <n-text depth="2">{{ preferences?.taboos || '无' }}</n-text>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <n-text strong>冲泡习惯：</n-text>
                        <n-text depth="2">{{ preferences?.brewHabits || '无' }}</n-text>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <n-text strong>消费场景：</n-text>
                        <n-space :size="[8, 4]" :wrap="true">
                            <n-tag v-for="scene in preferences?.consumptionScenario" :key="scene" size="small" :bordered="false">{{ scene }}</n-tag>
                        </n-space>
                        <n-text v-if="!preferences?.consumptionScenario?.length" depth="3">无</n-text>
                    </div>
                </n-space>
            </n-card>

            <!-- 消费记录 / 储值流水（标签页） -->
            <n-card :bordered="false">
                <n-tabs v-model:value="activeTab" type="line">
                    <!-- 消费记录 -->
                    <n-tab-pane name="consumption" tab="消费记录">
                        <n-data-table :columns="consumptionColumns" :data="consumptions" size="small" striped />
                    </n-tab-pane>

                    <!-- 储值流水 -->
                    <n-tab-pane name="balance" tab="储值流水">
                        <n-space vertical :size="12">
                            <n-space align="center" :size="12" :wrap="true">
                                <n-text depth="3">类型筛选：</n-text>
                                <n-select
                                    v-model:value="balanceLogFilter"
                                    :options="BALANCE_LOG_FILTER_OPTIONS"
                                    clearable
                                    placeholder="全部类型"
                                    style="width: 160px"
                                    @update:value="reloadBalanceLogs"
                                />
                                <n-button size="small" @click="reloadBalanceLogs">
                                    <template #icon>
                                        <span class="i-mdi-refresh align-middle" />
                                    </template>
                                    刷新
                                </n-button>
                            </n-space>
                            <n-data-table
                                :columns="balanceLogColumns"
                                :data="balanceLogs"
                                :loading="balanceLogLoading"
                                :pagination="balanceLogPagination"
                                @update:page="handleBalanceLogPageChange"
                            />
                        </n-space>
                    </n-tab-pane>
                </n-tabs>
            </n-card>

            <!-- 充值弹窗 -->
            <n-modal v-model:show="showRechargeModal">
                <n-card title="会员充值" style="width: 450px" :bordered="false" size="small">
                    <n-space vertical :size="12">
                        <n-form-item label="充值金额" required>
                            <n-input-number
                                v-model:value="rechargeAmount"
                                :min="0.01"
                                :precision="2"
                                placeholder="请输入充值金额"
                                style="width: 100%"
                            />
                        </n-form-item>
                        <n-form-item label="支付方式" required>
                            <n-select
                                v-model:value="rechargePaymentMethod"
                                :options="BALANCE_PAYMENT_OPTIONS"
                                placeholder="选择支付方式"
                            />
                        </n-form-item>
                        <n-form-item label="备注">
                            <n-input
                                v-model:value="rechargeRemark"
                                type="textarea"
                                placeholder="可选，填写充值来源或说明"
                                :rows="2"
                            />
                        </n-form-item>
                    </n-space>
                    <template #footer>
                        <n-space justify="end">
                            <n-button @click="showRechargeModal = false">取消</n-button>
                            <n-button
                                type="primary"
                                :loading="rechargeLoading"
                                :disabled="rechargeAmount <= 0"
                                @click="handleRecharge"
                            >
                                确认充值
                            </n-button>
                        </n-space>
                    </template>
                </n-card>
            </n-modal>

            <!-- 退款弹窗 -->
            <n-modal v-model:show="showRefundModal">
                <n-card title="会员退款" style="width: 450px" :bordered="false" size="small">
                    <n-space vertical :size="12">
                        <n-alert type="info" :show-icon="false">
                            当前余额：<n-text type="warning" class="font-mono">{{ '¥' + ((member?.balance) || 0).toFixed(2) }}</n-text>
                        </n-alert>
                        <n-form-item label="退款金额" required>
                            <n-input-number
                                v-model:value="refundAmount"
                                :min="0.01"
                                :max="member?.balance || 0"
                                :precision="2"
                                style="width: 100%"
                            />
                        </n-form-item>
                        <n-form-item label="退款方式" required>
                            <n-select
                                v-model:value="refundPaymentMethod"
                                :options="BALANCE_PAYMENT_OPTIONS"
                                placeholder="默认退到原支付方式"
                            />
                        </n-form-item>
                        <n-form-item label="退款原因" required>
                            <n-input
                                v-model:value="refundRemark"
                                type="textarea"
                                placeholder="必填，至少 5 个字符"
                                :rows="2"
                            />
                        </n-form-item>
                    </n-space>
                    <template #footer>
                        <n-space justify="end">
                            <n-button @click="showRefundModal = false">取消</n-button>
                            <n-button
                                type="warning"
                                :loading="refundLoading"
                                :disabled="!canRefund"
                                @click="handleRefund"
                            >
                                确认退款
                            </n-button>
                        </n-space>
                    </template>
                </n-card>
            </n-modal>
        </n-space>
    </div>
</template>

<script setup lang="ts">
/**
 * 会员详情页脚本
 * 集成储值余额功能（充值/退款/流水查询）
 */
import { ref, computed, reactive, h, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NTag, NText } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useMemberStore } from '@/stores'
import {
    getMemberDiscountRate,
    rechargeMemberBalance,
    refundMemberBalance,
    getMemberBalanceLogs,
    getMemberLastPaymentMethod,
    BALANCE_PAYMENT_OPTIONS,
    BALANCE_LOG_FILTER_OPTIONS
} from '@/api/members'
import type { Member, MemberPreference, MemberConsumptionItem, BalanceLog } from '@/types'

const route = useRoute()
const memberStore = useMemberStore()
const message = useMessage()

const memberId = computed(() => route.params.id as string)
const member = ref<Member | null>(null)
const preferences = ref<MemberPreference | null>(null)
const consumptions = ref<MemberConsumptionItem[]>([])

// ========== 标签页 ==========
const activeTab = ref('consumption')

// ========== 充值 ==========
const showRechargeModal = ref(false)
const rechargeAmount = ref(0)
const rechargePaymentMethod = ref<string>('cash')
const rechargeRemark = ref('')
const rechargeLoading = ref(false)

// ========== 退款 ==========
const showRefundModal = ref(false)
const refundAmount = ref(0)
const refundPaymentMethod = ref<string>('cash')
const refundRemark = ref('')
const refundLoading = ref(false)

const canRefund = computed(() =>
    refundAmount.value > 0
    && refundAmount.value <= (member.value?.balance || 0)
    && refundRemark.value.trim().length >= 5
)

// ========== 储值流水 ==========
const balanceLogFilter = ref<string | null>(null)
const balanceLogs = ref<BalanceLog[]>([])
const balanceLogLoading = ref(false)
const balanceLogPagination = reactive({
    page: 1,
    pageSize: 10,
    itemCount: 0,
    showSizePicker: false
})

// ========== 表格列定义 ==========
const consumptionColumns = [
    { title: '日期', key: 'createdAt', width: 150 },
    { title: '订单号', key: 'orderNo', width: 150 },
    {
        title: '消费金额',
        key: 'totalAmount',
        width: 100,
        render: (row: MemberConsumptionItem) => h(
            NText,
            { type: 'primary', class: 'font-mono' },
            { default: () => '¥' + row.totalAmount.toFixed(2) }
        )
    },
    {
        title: '获得积分',
        key: 'pointsEarned',
        width: 100,
        render: (row: MemberConsumptionItem) => h(
            NText,
            { type: 'success', class: 'font-mono' },
            { default: () => '+' + row.pointsEarned }
        )
    },
    {
        title: '使用积分',
        key: 'pointsDeduct',
        width: 100,
        render: (row: MemberConsumptionItem) => h(
            NText,
            { type: 'error', class: 'font-mono' },
            { default: () => row.pointsDeduct > 0 ? '-' + row.pointsDeduct : '0' }
        )
    }
]

const balanceLogColumns = [
    {
        title: '变动类型',
        key: 'changeType',
        width: 90,
        render: (row: BalanceLog) => h(
            NTag,
            { type: getChangeTypeColor(row.changeType) as any, size: 'small', bordered: false },
            { default: () => getChangeTypeLabel(row.changeType) }
        )
    },
    {
        title: '变动金额',
        key: 'changeAmount',
        width: 110,
        render: (row: BalanceLog) => h(
            NText,
            {
                type: row.changeAmount > 0 ? 'success' : 'error',
                class: 'font-mono',
                style: { whiteSpace: 'nowrap' }
            },
            {
                default: () => `${row.changeAmount > 0 ? '+' : ''}¥${row.changeAmount.toFixed(2)}`
            }
        )
    },
    {
        title: '变动后余额',
        key: 'balanceAfter',
        width: 110,
        render: (row: BalanceLog) => h(
            NText,
            { class: 'font-mono' },
            { default: () => `¥${row.balanceAfter.toFixed(2)}` }
        )
    },
    {
        title: '支付方式',
        key: 'paymentMethod',
        width: 100,
        render: (row: BalanceLog) => getPaymentMethodLabel(row.paymentMethod)
    },
    { title: '操作人', key: 'operator', width: 90 },
    {
        title: '关联订单',
        key: 'relatedOrderId',
        width: 140,
        render: (row: BalanceLog) => row.relatedOrderId || '-'
    },
    { title: '备注', key: 'remark', width: 180 },
    { title: '时间', key: 'createdAt', width: 150 }
]

// ========== 辅助函数 ==========
function getLevelType(level?: string | null): 'default' | 'info' | 'warning' {
    const map: Record<string, 'default' | 'info' | 'warning'> = {
        normal: 'default',
        silver: 'info',
        gold: 'warning'
    }
    return map[level || 'normal'] || 'default'
}

function getLevelName(level?: string | null): string {
    const map: Record<string, string> = {
        normal: '普通',
        silver: '银卡',
        gold: '金卡'
    }
    return map[level || 'normal']
}

function getChangeTypeColor(type: string): string {
    return ({ recharge: 'success', consume: 'warning', refund: 'error' } as Record<string, string>)[type] || 'default'
}

function getChangeTypeLabel(type: string): string {
    return ({ recharge: '充值', consume: '扣款', refund: '退款' } as Record<string, string>)[type] || type
}

function getPaymentMethodLabel(method: string): string {
    return ({ cash: '现金', wechat: '微信', alipay: '支付宝', memberBalance: '会员卡' } as Record<string, string>)[method] || method
}

// ========== 数据加载 ==========
async function loadMemberDetail() {
    if (!memberId.value) return
    try {
        const detail = await memberStore.getMemberDetailById(memberId.value)
        member.value = detail.member
        preferences.value = detail.preference

        const consumptionData = await memberStore.getMemberConsumptions(memberId.value)
        consumptions.value = consumptionData.records
    } catch (e: any) {
        message.error(`加载会员信息失败: ${e}`)
    }
}

async function loadBalanceLogs() {
    if (!memberId.value) return
    balanceLogLoading.value = true
    try {
        const result = await getMemberBalanceLogs(
            memberId.value,
            balanceLogPagination.page,
            balanceLogPagination.pageSize,
            balanceLogFilter.value || undefined
        )
        balanceLogs.value = result.list
        balanceLogPagination.itemCount = result.total
    } catch (e: any) {
        message.error(`加载储值流水失败: ${e}`)
    } finally {
        balanceLogLoading.value = false
    }
}

function reloadBalanceLogs() {
    balanceLogPagination.page = 1
    loadBalanceLogs()
}

function handleBalanceLogPageChange(page: number) {
    balanceLogPagination.page = page
    loadBalanceLogs()
}

// ========== 充值操作 ==========
function openRechargeModal() {
    rechargeAmount.value = 0
    rechargePaymentMethod.value = 'cash'
    rechargeRemark.value = ''
    showRechargeModal.value = true
}

async function handleRecharge() {
    if (rechargeAmount.value <= 0) {
        message.warning('请输入有效的充值金额')
        return
    }
    rechargeLoading.value = true
    try {
        const result = await rechargeMemberBalance({
            memberId: memberId.value,
            amount: rechargeAmount.value,
            paymentMethod: rechargePaymentMethod.value as 'cash' | 'wechat' | 'alipay',
            operator: '当前店员',
            remark: rechargeRemark.value || undefined
        })
        message.success(`充值成功，新余额 ¥${result.newBalance.toFixed(2)}`)
        showRechargeModal.value = false
        // 刷新会员信息和流水
        await loadMemberDetail()
        await loadBalanceLogs()
    } catch (e: any) {
        message.error(`充值失败: ${e}`)
    } finally {
        rechargeLoading.value = false
    }
}

// ========== 退款操作 ==========
async function openRefundModal() {
    // 默认退款金额 = 当前余额
    refundAmount.value = member.value?.balance || 0
    refundRemark.value = ''
    // 默认退款方式 = 最近一次充值支付方式
    try {
        const lastMethod = await getMemberLastPaymentMethod(memberId.value)
        if (lastMethod) {
            refundPaymentMethod.value = lastMethod
        } else {
            refundPaymentMethod.value = 'cash'
        }
    } catch (e) {
        refundPaymentMethod.value = 'cash'
    }
    showRefundModal.value = true
}

async function handleRefund() {
    if (!canRefund.value) {
        message.warning('请检查退款金额和退款原因（至少 5 个字符）')
        return
    }
    refundLoading.value = true
    try {
        const result = await refundMemberBalance({
            memberId: memberId.value,
            amount: refundAmount.value,
            paymentMethod: refundPaymentMethod.value as 'cash' | 'wechat' | 'alipay',
            operator: '当前店员',
            remark: refundRemark.value
        })
        message.success(`退款成功，剩余余额 ¥${result.newBalance.toFixed(2)}`)
        showRefundModal.value = false
        // 刷新会员信息和流水
        await loadMemberDetail()
        await loadBalanceLogs()
    } catch (e: any) {
        message.error(`退款失败: ${e}`)
    } finally {
        refundLoading.value = false
    }
}

// ========== 生命周期 ==========
onMounted(async () => {
    await loadMemberDetail()
    await loadBalanceLogs()
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
