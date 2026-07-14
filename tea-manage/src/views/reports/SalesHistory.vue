<!--
  @file 销售历史报表
  @description 茶易管 - 按日期/会员/商品筛选已完成销售订单，表格展示 + 本页合计，
               数据来自真实销售流水（get_sale_orders），解决原 Dashboard 仅有 Mock 的问题。
  @spec 统一视觉规范：根节点 tea-page p-md；功能区用 n-card 包裹；间距用 n-space；
       图标用 UnoCSS mdi；金额 toFixed(2) + font-mono；空态「暂无销售数据」。
-->
<template>
  <div class="tea-page p-md">
    <n-space vertical :size="16">
      <!-- 筛选区 -->
      <n-card :bordered="false">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="i-mdi-chart-box align-middle text-[15px] text-tea-primary" />
            <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">销售历史</span>
          </div>
        </template>
        <n-space align="end" :wrap="true" :size="12">
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            clearable
            placeholder="选择日期区间"
            style="width: 240px"
          />
          <n-select
            v-model:value="memberFilter"
            :options="memberOptions"
            placeholder="按会员筛选"
            clearable
            filterable
            style="width: 180px"
          />
          <n-select
            v-model:value="productFilter"
            :options="productOptions"
            placeholder="按商品筛选"
            clearable
            filterable
            style="width: 180px"
          />
          <n-button type="primary" :loading="loading" @click="handleSearch">
            <template #icon>
              <i class="i-mdi-magnify align-middle" />
            </template>
            查询
          </n-button>
          <n-button :disabled="loading" @click="handleReset">
            <template #icon>
              <i class="i-mdi-refresh align-middle" />
            </template>
            重置
          </n-button>
        </n-space>
      </n-card>

      <!-- 结果区 -->
      <n-card :bordered="false">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="i-mdi-receipt-text-outline align-middle text-[15px] text-tea-primary" />
            <span class="text-[15px] font-semibold text-[var(--tea-content-1)]">订单明细</span>
          </div>
        </template>
        <template #header-extra>
          <n-text depth="3" class="text-[12px]">
            共 {{ total }} 笔 · 本页
            <span class="font-mono text-[var(--tea-content-1)]">{{ formatMoney(pageSales) }}</span>
          </n-text>
        </template>

        <n-data-table
          :columns="columns"
          :data="orders"
          :loading="loading"
          :row-key="(row: SaleOrderSummary) => row.id"
          :bordered="false"
          size="small"
        />

        <div v-if="orders.length === 0 && !loading" class="flex justify-center py-8">
          <n-empty description="暂无销售数据" />
        </div>

        <div class="flex justify-end mt-3">
          <n-pagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="total"
            :page-sizes="[10, 20, 50]"
            show-size-picker
            @update:page="load"
            @update:page-size="handlePageSizeChange"
          />
        </div>
      </n-card>

      <!-- 客户退货弹窗（CR-02 客户退货闭环） -->
      <n-modal
        v-model:show="returnModalVisible"
        preset="card"
        title="客户退货"
        style="width: 560px; max-width: 92vw"
        :bordered="false"
      >
        <template v-if="returnOrder">
          <n-space vertical :size="12">
            <n-text depth="3" class="text-[13px]">
              原单号：<span class="font-mono">{{ returnOrder.orderNo }}</span>
              · 会员：{{ returnOrder.memberName || '散客' }}
            </n-text>
            <n-divider style="margin: 4px 0" />
            <div
              v-for="item in returnOrder.items"
              :key="item.id"
              class="flex items-center justify-between gap-3 py-1"
            >
              <div class="min-w-0">
                <div class="truncate">{{ item.productName }}（{{ item.unitName }}）</div>
                <n-text depth="3" class="text-[12px] font-mono">
                  {{ formatMoney(item.unitPrice) }} × 原售 {{ item.quantity }}
                </n-text>
              </div>
              <n-input-number
                v-model:value="returnQtys[item.id]"
                :min="0"
                :max="item.quantity"
                :step="1"
                style="width: 110px"
              />
            </div>
            <n-divider style="margin: 4px 0" />
            <div class="flex items-center justify-between">
              <span class="text-[14px]">退款合计</span>
              <span class="font-mono font-semibold text-[var(--tea-content-1)]">{{ formatMoney(returnRefundTotal) }}</span>
            </div>
            <n-input
              v-model:value="returnRemark"
              type="textarea"
              placeholder="退货原因（选填）"
              :rows="2"
            />
            <n-space justify="end">
              <n-button @click="returnModalVisible = false">取消</n-button>
              <n-button
                type="primary"
                :loading="returnSubmitting"
                :disabled="returnRefundTotal <= 0"
                @click="submitReturn"
              >
                确认退货
              </n-button>
            </n-space>
          </n-space>
        </template>
      </n-modal>
    </n-space>
  </div>
</template>

<script setup lang="ts">
/**
 * 销售历史报表页
 * - 拉取真实销售订单（get_sale_orders），筛选：日期区间 / 会员 / 商品
 * - 表格展示明细，并给出本页销售额合计
 * - 分页交由后端（page / pageSize），total 来自后端统计
 */
import { h, onMounted, ref, computed } from 'vue'
import {
  NCard, NSpace, NButton, NDatePicker, NSelect, NDataTable, NPagination,
  NEmpty, NText, NTag, NModal, NInputNumber, NInput, NDivider, useMessage,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { getSaleOrders, getSaleOrder, returnSaleOrder } from '@/api/sales'
import { getMembers } from '@/api/members'
import { getProducts } from '@/api/products'
import type { SaleOrderSummary, SaleOrderQuery, SaleOrder, ReturnSaleOrderInput } from '@/types'

const message = useMessage()

const loading = ref(false)
const orders = ref<SaleOrderSummary[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const dateRange = ref<[number, number] | null>(null)
const memberFilter = ref<string | null>(null)
const productFilter = ref<string | null>(null)
const memberOptions = ref<SelectOption[]>([])
const productOptions = ref<SelectOption[]>([])

/** 金额格式化：保留两位小数 + 千分位 */
function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 时间戳 → YYYY-MM-DD */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const payMethodMap: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  memberBalance: '会员余额',
  combined: '组合支付',
}

const statusMap: Record<string, { text: string; type: 'success' | 'warning' | 'default' | 'error' }> = {
  completed: { text: '已完成', type: 'success' },
  pending: { text: '挂单', type: 'warning' },
  cancelled: { text: '已取消', type: 'error' },
}

/** 本页销售额合计（仅当前页，避免跨页误算） */
const pageSales = ref(0)

const columns: DataTableColumns<SaleOrderSummary> = [
  { title: '订单号', key: 'orderNo', width: 160, render: (row) => h('span', { class: 'font-mono' }, row.orderNo) },
  { title: '时间', key: 'createdAt', width: 160 },
  {
    title: '会员',
    key: 'memberName',
    width: 120,
    render: (row) => h('span', {}, row.memberName || '散客'),
  },
  { title: '商品数', key: 'itemCount', width: 80, align: 'right' },
  {
    title: '应收',
    key: 'totalAmount',
    width: 110,
    align: 'right',
    render: (row) => h('span', { class: 'font-mono' }, formatMoney(row.totalAmount)),
  },
  {
    title: '优惠',
    key: 'discountAmount',
    width: 100,
    align: 'right',
    render: (row) => h('span', { class: 'font-mono' }, formatMoney(row.discountAmount)),
  },
  {
    title: '实收',
    key: 'actualAmount',
    width: 110,
    align: 'right',
    render: (row) =>
      h('span', { class: 'font-mono font-semibold text-[var(--tea-content-1)]' }, formatMoney(row.actualAmount)),
  },
  {
    title: '支付方式',
    key: 'payMethod',
    width: 110,
    render: (row) => h('span', {}, payMethodMap[row.payMethod || ''] || '—'),
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (row) => {
      const s = statusMap[row.status] || { text: row.status, type: 'default' as const }
      return h(NTag, { size: 'small', bordered: false, type: s.type }, { default: () => s.text })
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 90,
    fixed: 'right',
    render: (row) => {
      if (row.status !== 'completed') return h('span', { class: 'text-[12px] text-[var(--tea-content-3)]' }, '—')
      return h(
        NButton,
        {
          size: 'small',
          tertiary: true,
          type: 'error',
          onClick: () => openReturn(row),
        },
        { default: () => '退货' },
      )
    },
  },
]

function buildQuery(): SaleOrderQuery {
  const q: SaleOrderQuery = { page: page.value, pageSize: pageSize.value }
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    q.startDate = formatDate(dateRange.value[0])
    q.endDate = formatDate(dateRange.value[1])
  }
  if (memberFilter.value) q.memberId = memberFilter.value
  if (productFilter.value) q.productId = productFilter.value
  return q
}

async function load() {
  loading.value = true
  try {
    const res = await getSaleOrders(buildQuery())
    orders.value = res.list
    total.value = res.total
    pageSales.value = res.list.reduce((sum, o) => sum + o.actualAmount, 0)
  } catch (e: any) {
    message.error(`查询失败: ${e}`)
    orders.value = []
    total.value = 0
    pageSales.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  load()
}

function handleReset() {
  dateRange.value = null
  memberFilter.value = null
  productFilter.value = null
  page.value = 1
  load()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  load()
}

// ========== 客户退货（CR-02） ==========
const returnModalVisible = ref(false)
const returnOrder = ref<SaleOrder | null>(null)
const returnQtys = ref<Record<string, number>>({})
const returnRemark = ref('')
const returnSubmitting = ref(false)

/** 退款合计（按退货数量 × 原单价，四舍五入到分） */
const returnRefundTotal = computed(() => {
  if (!returnOrder.value) return 0
  const total = returnOrder.value.items.reduce(
    (sum, item) => sum + (returnQtys.value[item.id] || 0) * item.unitPrice,
    0,
  )
  return Math.round(total * 100) / 100
})

/** 打开退货弹窗：加载原单明细并初始化退货数量 */
async function openReturn(row: SaleOrderSummary) {
  try {
    const order = await getSaleOrder(row.id)
    returnOrder.value = order
    returnQtys.value = Object.fromEntries(order.items.map((i) => [i.id, 0]))
    returnRemark.value = ''
    returnModalVisible.value = true
  } catch (e: any) {
    message.error(`加载订单失败: ${e}`)
  }
}

/** 提交客户退货 */
async function submitReturn() {
  if (!returnOrder.value) return
  const items = returnOrder.value.items
    .filter((i) => (returnQtys.value[i.id] || 0) > 0)
    .map((i) => ({
      productId: i.productId,
      unitId: i.unitId,
      quantity: returnQtys.value[i.id],
    }))
  if (items.length === 0) {
    message.warning('请至少选择一项退货商品')
    return
  }
  returnSubmitting.value = true
  try {
    const input: ReturnSaleOrderInput = {
      originalOrderId: returnOrder.value.id,
      items,
      remark: returnRemark.value || undefined,
    }
    const result = await returnSaleOrder(input)
    message.success(`退货成功，退款 ${formatMoney(result.refundAmount)}`)
    returnModalVisible.value = false
    load()
  } catch (e: any) {
    message.error(`退货失败: ${e}`)
  } finally {
    returnSubmitting.value = false
  }
}

/** 加载筛选下拉数据（会员/商品） */
async function loadOptions() {
  try {
    const [members, products] = await Promise.all([
      getMembers(1, 200),
      getProducts(),
    ])
    memberOptions.value = members.list.map((m) => ({ label: m.name, value: m.id }))
    productOptions.value = products.map((p) => ({ label: p.name, value: p.id }))
  } catch (e) {
    console.error('[SalesHistory] 加载筛选选项失败:', e)
  }
}

onMounted(() => {
  loadOptions()
  load()
})
</script>

<style scoped>
/* 页面统一由 n-space 控制区块间距 */
.tea-page :deep(.n-card) {
  margin-bottom: 0 !important;
}
.tea-page :deep(.n-card + .n-card) {
  margin-top: 0 !important;
}
</style>
