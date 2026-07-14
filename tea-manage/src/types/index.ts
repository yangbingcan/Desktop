/**
 * @file 全局类型定义
 * @description 所有与后端交互的类型统一使用 camelCase（后端已加 rename_all = "camelCase"）
 */

// ========== 枚举/字面量类型 ==========

/** 商品类型 */
export type ProductType = 'weight' | 'count'

/** 基准单位 */
export type BaseUnit = 'g' | 'pcs'

/** 会员等级 */
export type MemberLevel = 'normal' | 'silver' | 'gold'

/** 支付方式（配合后端 serde rename_all = "camelCase"） */
export type PayMethod = 'cash' | 'wechat' | 'alipay' | 'memberBalance' | 'combined'

/** 库存流水类型 */
export type StockFlowType = 'purchaseIn' | 'saleOut' | 'damageOut' | 'returnOut' | 'adjustIn' | 'adjustOut'

/** 销售订单状态 */
export type SaleOrderStatus = 'pending' | 'completed' | 'cancelled'

/** 支付状态 */
export type PayStatus = 'unpaid' | 'paid' | 'refunded'

// ========== 分页 ==========

/** 通用分页结果 */
export interface PageResult<T> {
    list: T[]
    total: number
    page: number
    pageSize: number
}

// ========== 商品相关 ==========

/** 商品 */
export interface Product {
    id: string
    code: string
    name: string
    categoryId: string | null
    type: ProductType
    baseUnit: BaseUnit
    origin?: string
    year?: string
    grade?: string
    fermentationLevel?: string
    roastLevel?: string
    imageUrl?: string
    defaultUnitId?: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

/** 销售单位 */
export interface SalesUnit {
    id: string
    productId: string
    name: string
    conversionToBase: number
    retailPrice: number
    memberPrice: number
}

/** 商品分类 */
export interface ProductCategory {
    id: string
    name: string
    parentId?: string
    level: 1 | 2
    sortOrder: number
}

/** 商品创建输入 */
export interface ProductCreateInput {
    name: string
    categoryId: string | null
    type: ProductType
    origin?: string
    year?: string
    grade?: string
    fermentationLevel?: string
    roastLevel?: string
    imageUrl?: string
    units: SalesUnitInput[]
}

/** 商品更新输入 */
export interface ProductUpdateInput {
    name?: string
    categoryId?: string | null
    /** 商品类型 */
    type?: ProductType
    /** 基准单位 */
    baseUnit?: BaseUnit
    origin?: string
    year?: string
    grade?: string
    fermentationLevel?: string
    roastLevel?: string
    imageUrl?: string
    isActive?: boolean
    units?: SalesUnitInput[]
}

/** 销售单位输入 */
export interface SalesUnitInput {
    id?: string
    name: string
    conversionToBase: number
    retailPrice: number
    memberPrice: number
}

// ========== 库存相关 ==========

/** 库存概览项 */
export interface InventoryItem {
    productId: string
    productName: string
    categoryName: string | null
    productType: ProductType
    stockGrams: number
    stockUnits: number
    displayStock: string
}

/** 库存批次 */
export interface InventoryBatch {
    id: string
    productId: string
    batchCode: string
    purchasePrice: number
    totalGrams: number
    remainingGrams: number
    supplierId: string | null
    producedDate: string | null
    expireDate: string | null
    createdAt: string
}

/** 库存流水 */
export interface StockFlow {
    id: string
    productId: string
    batchId: string | null
    flowType: StockFlowType
    changeGrams: number
    balanceGrams: number
    orderId: string | null
    remark: string | null
    createdAt: string
}

/** 商品库存详情 */
export interface InventoryDetail {
    productId: string
    productName: string
    categoryName: string | null
    productType: ProductType
    stockGrams: number
    stockUnits: number
    batches: InventoryBatch[]
    recentFlows: StockFlow[]
}

/** 采购入库输入 */
export interface PurchaseInput {
    supplierId?: string
    handler?: string
    items: PurchaseItemInput[]
    remark?: string
    /** 付款状态：unpaid / partial / paid */
    paymentStatus?: 'unpaid' | 'partial' | 'paid'
}

/** 采购单据明细输入 */
export interface PurchaseItemInput {
    productId: string
    unitId: string
    quantity: number
    unitPrice: number
}

/** 采购单据 */
export interface PurchaseOrder {
    id: string
    orderNo: string
    supplierId: string | null
    /** 供应商名称（JOIN suppliers.name） */
    supplierName: string
    handler: string | null
    totalAmount: number
    /** 付款状态：unpaid / partial / paid */
    paymentStatus: string
    remark: string | null
    items: PurchaseOrderItem[]
    createdAt: string
}

/** 采购单据明细 */
export interface PurchaseOrderItem {
    productId: string
    productName: string
    unitId: string
    unitName: string
    quantity: number
    grams: number
    unitPrice: number
    subtotal: number
    batchId: string
    batchCode: string
}

/** 采购单列表项（包含 JOIN 后的展示字段） */
export interface PurchaseOrderListItem {
    id: string
    orderNo: string
    supplierId: string
    supplierName: string
    handler: string | null
    totalAmount: number
    paymentStatus: string
    /** 该采购单包含的商品行数 */
    itemCount: number
    remark: string
    createdAt: string
}

/** 盘点调整输入 */
export interface AdjustInput {
    productId: string
    grams: number
    remark: string
}

/** 报损出库输入 */
export interface DamageOutInput {
    productId: string
    grams: number
    remark: string
}

/** 库存变更结果 */
export interface StockChangeResult {
    success: boolean
    productId: string
    changeGrams: number
    newBalance: number
    flowId: string
}

// ========== 销售相关 ==========

/** 购物车项（前端用） */
export interface CartItem {
    productId: string
    productName: string
    unitId: string
    unitName: string
    quantity: number
    price: number
    grams: number
    subtotal: number
}

/** 销售明细输入 */
export interface SaleItemInput {
    productId: string
    unitId: string
    quantity: number
}

/** 销售订单输入 */
export interface SaleOrderInput {
    items: SaleItemInput[]
    memberId?: string
    /** 是否应用会员折扣（受系统「启用会员折扣」开关控制，由前端按开关状态传入） */
    applyMemberDiscount?: boolean
    pointsDeduct?: number
    payMethod?: string
    remark?: string
}

/** 客户销售退货明细输入（CR-02） */
export interface ReturnSaleItemInput {
    productId: string
    unitId: string
    /** 退货数量（必须 > 0 且不超过原单该商品已售数量） */
    quantity: number
}

/** 客户销售退货输入（CR-02） */
export interface ReturnSaleOrderInput {
    /** 原销售订单 id */
    originalOrderId: string
    items: ReturnSaleItemInput[]
    remark?: string
}

/** 客户销售退货明细（CR-02） */
export interface ReturnSaleItem {
    id: string
    orderId: string
    productId: string
    productName: string
    unitId: string
    unitName: string
    quantity: number
    unitPrice: number
    subtotal: number
}

/** 客户销售退货单（CR-02） */
export interface ReturnSaleOrder {
    id: string
    orderNo: string
    originalOrderId: string
    memberId?: string
    memberName?: string
    totalAmount: number
    refundAmount: number
    pointsReversed: number
    remark?: string
    items: ReturnSaleItem[]
    createdAt: string
}

/** 销售单据明细 */
export interface SaleOrderItem {
    id: string
    orderId: string
    productId: string
    productName: string
    unitName: string
    unitId: string
    quantity: number
    unitPrice: number
    grams: number
    subtotal: number
}

/** 销售单据 */
export interface SaleOrder {
    id: string
    orderNo: string
    memberId: string | null
    memberName: string | null
    totalAmount: number
    discountAmount: number
    pointsDeduct: number
    pointsEarned: number
    actualAmount: number
    payMethod: string | null
    payStatus: string
    status: string
    remark: string | null
    items: SaleOrderItem[]
    createdAt: string
}

/** 挂起订单 */
export interface HeldOrder {
    id: string
    orderNo: string
    memberName: string | null
    itemCount: number
    totalAmount: number
    createdAt: string
}

/** 销售订单汇总（列表/报表用，不含明细） */
export interface SaleOrderSummary {
    id: string
    orderNo: string
    memberId: string | null
    memberName: string | null
    totalAmount: number
    discountAmount: number
    pointsDeduct: number
    pointsEarned: number
    actualAmount: number
    payMethod: string | null
    payStatus: string
    status: string
    remark: string | null
    itemCount: number
    createdAt: string
}

/** 首页经营指标 */
export interface DashboardStats {
    todayOrders: number
    todaySales: number
    lowStockCount: number
    newMembers: number
}

/** 销售历史查询条件 */
export interface SaleOrderQuery {
    startDate?: string
    endDate?: string
    memberId?: string
    productId?: string
    page?: number
    pageSize?: number
}

// ========== 会员相关 ==========

/** 会员 */
export interface Member {
    id: string
    name: string
    phone: string
    gender: string | null
    birthday: string | null
    level: MemberLevel
    points: number
    balance: number
    totalConsume: number
    consumeCount: number
    lastVisit: string | null
    createdAt: string
}

/** 会员口味偏好 */
export interface MemberPreference {
    memberId: string
    preferredTeas: string[]
    tastePreferences: string[]
    taboos: string
    brewHabits: string
    consumptionScenario: string[]
    remark: string
}

/** 会员偏好更新输入 */
export interface MemberPreferenceInput {
    preferredTeas: string[]
    tastePreferences: string[]
    taboos: string
    brewHabits: string
    consumptionScenario: string[]
    remark: string
}

/** 会员详情（包含偏好） */
export interface MemberDetail {
    member: Member
    preference: MemberPreference | null
}

/** 会员消费记录项 */
export interface MemberConsumptionItem {
    orderId: string
    orderNo: string
    totalAmount: number
    pointsEarned: number
    pointsDeduct: number
    createdAt: string
}

/** 会员消费记录 */
export interface MemberConsumption {
    memberId: string
    totalConsume: number
    consumeCount: number
    records: MemberConsumptionItem[]
}

// ========== 储值余额相关（v0.3.1 M06 储值余额功能） ==========

/** 储值流水变动类型 */
export type BalanceChangeType = 'recharge' | 'consume' | 'refund'

/** 支付方式 */
export type PaymentMethod = 'cash' | 'wechat' | 'alipay'

/** 充值输入 */
export interface RechargeInput {
    memberId: string
    amount: number
    paymentMethod: PaymentMethod
    operator: string
    remark?: string
    bonusAmount?: number
}

/** 充值结果 */
export interface RechargeResult {
    logId: string
    newBalance: number
    createdAt: string
}

/** 退款输入 */
export interface RefundInput {
    memberId: string
    amount: number
    paymentMethod: PaymentMethod
    operator: string
    remark: string
}

/** 退款结果 */
export interface RefundResult {
    logId: string
    newBalance: number
    createdAt: string
}

/** 储值流水 */
export interface BalanceLog {
    id: string
    memberId: string
    changeType: BalanceChangeType
    changeAmount: number
    balanceAfter: number
    paymentMethod: string
    operator: string
    relatedOrderId: string | null
    bonusAmount: number
    feeAmount: number
    remark: string
    createdAt: string
}

// ========== 系统相关 ==========

/** 系统设置 */
export interface SystemSettings {
    shopName: string
    shopAddress: string
    shopPhone: string
    allowNegativeStock: boolean
    enableMemberDiscount: boolean
    enablePrintReceipt: boolean
    defaultReceiptTemplate: string
}

// ========== 供应商相关（v0.2.0 M04 出入库闭环） ==========

/** 供应商 */
export interface Supplier {
    id: string
    name: string
    contactPerson?: string
    contactPhone?: string
    address?: string
    /** 主营品类（JSON 数组） */
    mainCategories: string[]
    remark: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

/** 供应商输入（新增/编辑） */
export interface SupplierInput {
    name: string
    contactPerson?: string
    contactPhone?: string
    address?: string
    mainCategories: string[]
    remark?: string
}

// ========== 退货出库相关（v0.2.0 M04 出入库闭环） ==========

/** 退货原因 */
export type ReturnReason = '质量问题' | '数量超出' | '保质期' | '其他'

/** 退货单明细（返回） */
export interface ReturnOrderItem {
    id: string
    orderId: string
    productId: string
    productName: string
    unitId: string
    unitName: string
    batchId: string
    batchCode: string
    quantity: number
    unitPrice: number
    grams: number
    subtotal: number
}

/** 退货单输入 */
export interface ReturnOrderInput {
    supplierId: string
    /** 退货日期 YYYY-MM-DD */
    returnDate: string
    returnReason: ReturnReason
    remark?: string
    items: ReturnItemInput[]
}

/** 退货明细输入 */
export interface ReturnItemInput {
    productId: string
    unitId: string
    batchId: string
    quantity: number
}

/** 退货单（返回） */
export interface ReturnOrder {
    id: string
    orderNo: string
    supplierId: string
    supplierName: string
    returnDate: string
    returnReason: string
    totalAmount: number
    remark: string
    items: ReturnOrderItem[]
    createdAt: string
}

/** 退货单列表项 */
export interface ReturnOrderListItem {
    id: string
    orderNo: string
    supplierName: string
    returnDate: string
    returnReason: string
    totalAmount: number
    itemCount: number
    createdAt: string
}

/** 批次选项（退货选择原批次用） */
export interface BatchOption {
    id: string
    batchCode: string
    remainingGrams: number
    purchasePrice: number
    createdAt: string
}

// ========== 打印相关 ==========

/** 打印模板 */
export interface PrintTemplate {
    id: string
    name: string
    type: 'receipt' | 'purchase' | 'damage' | 'return'
    content: string
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

// ========== 供应商付款相关（v0.3.5 新增） ==========

/** 供应商付款记录 */
export interface SupplierPayment {
    id: string
    supplierId: string
    purchaseOrderId: string | null
    amount: number
    paymentMethod: string
    paymentDate: string
    remark: string
    createdAt: string
}

/** 创建付款输入 */
export interface CreatePaymentInput {
    supplierId: string
    purchaseOrderId?: string
    amount: number
    paymentMethod: string
    paymentDate: string
    remark?: string
}

/** 供应商财务流水项 */
export interface FinancialFlowItem {
    id: string
    flowType: string
    flowTypeName: string
    orderNo: string | null
    amount: number
    balance: number | null
    remark: string
    createdAt: string
}

/** 供应商余额 */
export interface SupplierBalance {
    totalPurchase: number
    totalPaid: number
    totalReturn: number
    balance: number
}
