/**
 * @file 前端 TS interface 字段事实清单
 * @description 手工维护前端 src/types/index.ts 中所有 interface 的字段名
 *
 * 维护规则：
 * - 每个接口记录：TS 名、字段名清单、对应后端 Rust 结构体名
 * - 字段名按 TS 定义顺序
 * - 仅记录业务字段，不记录工具类型（如 CartItem 仅前端使用）
 *
 * 数据来源：src/types/index.ts（截至 2026-07-03 v0.3.2）
 */

/** 单个前端 TS interface 的契约 */
export interface TypeContract {
    /** TS interface 名 */
    tsName: string
    /** 字段名清单（按定义顺序，可选字段加 ? 后缀） */
    fields: string[]
    /** 对应的后端 Rust 结构体名（如有） */
    rustName?: string
    /** 来源文件 */
    sourceFile: string
    /** 备注 */
    note?: string
}

/**
 * 前端全部业务 interface 清单（不含纯前端类型如 CartItem）
 */
export const FRONTEND_TYPES: TypeContract[] = [
    // ========== 分页 ==========
    {
        tsName: 'PageResult',
        fields: ['list', 'total', 'page', 'pageSize'],
        rustName: 'PageResult',
        sourceFile: 'types/index.ts',
    },

    // ========== 商品 ==========
    {
        tsName: 'Product',
        fields: [
            'id', 'code', 'name', 'categoryId', 'type', 'baseUnit',
            'origin?', 'year?', 'grade?', 'fermentationLevel?', 'roastLevel?',
            'imageUrl?', 'defaultUnitId?', 'isActive', 'createdAt', 'updatedAt',
        ],
        rustName: 'Product',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'SalesUnit',
        // 前端 SalesUnit 缺少 sortOrder/createdAt/updatedAt 字段
        fields: ['id', 'productId', 'name', 'conversionToBase', 'retailPrice', 'memberPrice'],
        rustName: 'SalesUnit',
        sourceFile: 'types/index.ts',
        note: '前端缺少后端的 sortOrder/createdAt/updatedAt 字段（不影响序列化，但前端拿不到这些字段）',
    },
    {
        tsName: 'ProductCategory',
        fields: ['id', 'name', 'parentId?', 'level', 'sortOrder'],
        rustName: 'Category',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ProductCreateInput',
        fields: [
            'name', 'categoryId', 'type', 'origin?', 'year?', 'grade?',
            'fermentationLevel?', 'roastLevel?', 'imageUrl?', 'units',
        ],
        rustName: 'ProductInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ProductUpdateInput',
        fields: [
            'name?', 'categoryId?', 'origin?', 'year?', 'grade?',
            'fermentationLevel?', 'roastLevel?', 'imageUrl?', 'isActive?', 'units?',
        ],
        rustName: 'ProductUpdate',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'SalesUnitInput',
        fields: ['id?', 'name', 'conversionToBase', 'retailPrice', 'memberPrice'],
        rustName: 'SalesUnitInput',
        sourceFile: 'types/index.ts',
    },

    // ========== 库存 ==========
    {
        tsName: 'InventoryItem',
        fields: [
            'productId', 'productName', 'categoryName', 'productType',
            'stockGrams', 'stockUnits', 'displayStock',
        ],
        rustName: 'InventoryItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'InventoryBatch',
        fields: [
            'id', 'productId', 'batchCode', 'purchasePrice', 'totalGrams',
            'remainingGrams', 'supplierId', 'producedDate', 'expireDate', 'createdAt',
        ],
        rustName: 'InventoryBatch',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'StockFlow',
        fields: [
            'id', 'productId', 'batchId', 'flowType', 'changeGrams',
            'balanceGrams', 'orderId', 'remark', 'createdAt',
        ],
        rustName: 'StockFlow',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'InventoryDetail',
        fields: [
            'productId', 'productName', 'categoryName', 'productType',
            'stockGrams', 'stockUnits', 'batches', 'recentFlows',
        ],
        rustName: 'InventoryDetail',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'PurchaseInput',
        fields: ['supplierId?', 'handler?', 'items', 'remark?', 'paymentStatus?'],
        rustName: 'PurchaseInput',
        sourceFile: 'types/index.ts',
    },
    {
        // ⚠️ 前端使用 camelCase，后端默认 snake_case
        tsName: 'PurchaseItemInput',
        fields: ['productId', 'unitId', 'quantity', 'unitPrice'],
        rustName: 'PurchaseItemInput',
        sourceFile: 'types/index.ts',
        note: '🚨 与后端契约不一致：前端 camelCase，后端默认 snake_case (product_id, unit_id, unit_price)',
    },
    {
        tsName: 'PurchaseOrder',
        fields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'handler',
            'totalAmount', 'paymentStatus', 'remark', 'items', 'createdAt',
        ],
        rustName: 'PurchaseOrder',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'PurchaseOrderItem',
        fields: [
            'productId', 'productName', 'unitId', 'unitName', 'quantity',
            'grams', 'unitPrice', 'subtotal', 'batchId', 'batchCode',
        ],
        rustName: 'PurchaseOrderItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'PurchaseOrderListItem',
        fields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'handler',
            'totalAmount', 'paymentStatus', 'itemCount', 'remark', 'createdAt',
        ],
        rustName: 'PurchaseOrderListItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'AdjustInput',
        fields: ['productId', 'grams', 'remark'],
        rustName: 'AdjustInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'DamageOutInput',
        fields: ['productId', 'grams', 'remark'],
        rustName: 'DamageOutInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'StockChangeResult',
        fields: ['success', 'productId', 'changeGrams', 'newBalance', 'flowId'],
        rustName: 'StockChangeResult',
        sourceFile: 'types/index.ts',
    },

    // ========== 销售 ==========
    {
        tsName: 'SaleItemInput',
        fields: ['productId', 'unitId', 'quantity'],
        rustName: 'SaleItemInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'SaleOrderInput',
        fields: ['items', 'memberId?', 'pointsDeduct?', 'payMethod?', 'remark?'],
        rustName: 'SaleOrderInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'SaleOrderItem',
        // 前端有 unitId 字段，后端没有
        fields: [
            'id', 'orderId', 'productId', 'productName', 'unitName', 'unitId',
            'quantity', 'unitPrice', 'grams', 'subtotal',
        ],
        rustName: 'SaleOrderItem',
        sourceFile: 'types/index.ts',
        note: '前端比后端多 unitId 字段（不影响反序列化，但前端可能拿不到这个字段值）',
    },
    {
        tsName: 'SaleOrder',
        fields: [
            'id', 'orderNo', 'memberId', 'memberName', 'totalAmount',
            'discountAmount', 'pointsDeduct', 'pointsEarned', 'actualAmount',
            'payMethod', 'payStatus', 'status', 'remark', 'items', 'createdAt',
        ],
        rustName: 'SaleOrder',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'HeldOrder',
        fields: ['id', 'orderNo', 'memberName', 'itemCount', 'totalAmount', 'createdAt'],
        rustName: 'HeldOrder',
        sourceFile: 'types/index.ts',
    },

    // ========== 会员 ==========
    {
        tsName: 'Member',
        fields: [
            'id', 'name', 'phone', 'gender', 'birthday', 'level', 'points',
            'balance', 'totalConsume', 'consumeCount', 'lastVisit', 'createdAt',
        ],
        rustName: 'Member',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'MemberPreference',
        fields: [
            'memberId', 'preferredTeas', 'tastePreferences', 'taboos',
            'brewHabits', 'consumptionScenario', 'remark',
        ],
        rustName: 'MemberPreference',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'MemberPreferenceInput',
        fields: [
            'preferredTeas', 'tastePreferences', 'taboos',
            'brewHabits', 'consumptionScenario', 'remark',
        ],
        rustName: 'MemberPreferenceInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'MemberDetail',
        fields: ['member', 'preference'],
        rustName: 'MemberDetail',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'MemberConsumptionItem',
        fields: ['orderId', 'orderNo', 'totalAmount', 'pointsEarned', 'pointsDeduct', 'createdAt'],
        rustName: 'MemberConsumptionItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'MemberConsumption',
        fields: ['memberId', 'totalConsume', 'consumeCount', 'records'],
        rustName: 'MemberConsumption',
        sourceFile: 'types/index.ts',
    },

    // ========== 储值余额 ==========
    {
        tsName: 'RechargeInput',
        fields: ['memberId', 'amount', 'paymentMethod', 'operator', 'remark?', 'bonusAmount?'],
        rustName: 'RechargeInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'RechargeResult',
        fields: ['logId', 'newBalance', 'createdAt'],
        rustName: 'RechargeResult',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'RefundInput',
        fields: ['memberId', 'amount', 'paymentMethod', 'operator', 'remark'],
        rustName: 'RefundInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'RefundResult',
        fields: ['logId', 'newBalance', 'createdAt'],
        rustName: 'RefundResult',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'BalanceLog',
        fields: [
            'id', 'memberId', 'changeType', 'changeAmount', 'balanceAfter',
            'paymentMethod', 'operator', 'relatedOrderId', 'bonusAmount',
            'feeAmount', 'remark', 'createdAt',
        ],
        rustName: 'BalanceLog',
        sourceFile: 'types/index.ts',
    },

    // ========== 供应商 ==========
    {
        tsName: 'Supplier',
        fields: [
            'id', 'name', 'contactPerson?', 'contactPhone?', 'address?',
            'mainCategories', 'remark', 'isActive', 'createdAt', 'updatedAt',
        ],
        rustName: 'Supplier',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'SupplierInput',
        fields: ['name', 'contactPerson?', 'contactPhone?', 'address?', 'mainCategories', 'remark?'],
        rustName: 'SupplierInput',
        sourceFile: 'types/index.ts',
    },

    // ========== 退货 ==========
    {
        tsName: 'ReturnOrderItem',
        fields: [
            'id', 'orderId', 'productId', 'productName', 'unitId', 'unitName',
            'batchId', 'batchCode', 'quantity', 'unitPrice', 'grams', 'subtotal',
        ],
        rustName: 'ReturnOrderItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ReturnOrderInput',
        fields: ['supplierId', 'returnDate', 'returnReason', 'remark?', 'items'],
        rustName: 'ReturnOrderInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ReturnItemInput',
        fields: ['productId', 'unitId', 'batchId', 'quantity'],
        rustName: 'ReturnItemInput',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ReturnOrder',
        fields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'returnDate',
            'returnReason', 'totalAmount', 'remark', 'items', 'createdAt',
        ],
        rustName: 'ReturnOrder',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'ReturnOrderListItem',
        fields: [
            'id', 'orderNo', 'supplierName', 'returnDate', 'returnReason',
            'totalAmount', 'itemCount', 'createdAt',
        ],
        rustName: 'ReturnOrderListItem',
        sourceFile: 'types/index.ts',
    },
    {
        tsName: 'BatchOption',
        fields: ['id', 'batchCode', 'remainingGrams', 'purchasePrice', 'createdAt'],
        rustName: 'BatchOption',
        sourceFile: 'types/index.ts',
    },

    // ========== 枚举/字面量（仅记录值列表） ==========
    {
        tsName: 'ProductType',
        fields: ['weight', 'count'],
        rustName: 'ProductType',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        tsName: 'BaseUnit',
        fields: ['g', 'pcs'],
        rustName: 'BaseUnit',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        tsName: 'MemberLevel',
        fields: ['normal', 'silver', 'gold'],
        rustName: 'MemberLevel',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        // ⚠️ 前端 PayMethod 字面量与后端不一致
        tsName: 'PayMethod',
        fields: ['cash', 'wechat', 'alipay', 'memberBalance', 'combined'],
        rustName: 'PayMethod',
        sourceFile: 'types/index.ts',
        note: '🚨 与后端不一致：前端 memberBalance/combined，后端 member_card/mixed',
    },
    {
        tsName: 'StockFlowType',
        fields: ['purchaseIn', 'saleOut', 'damageOut', 'returnOut', 'adjustIn', 'adjustOut'],
        rustName: 'FlowType',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        tsName: 'SaleOrderStatus',
        fields: ['pending', 'completed', 'cancelled'],
        rustName: 'OrderStatus',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        tsName: 'PayStatus',
        // ⚠️ 前端 PayStatus 字面量与后端不一致
        fields: ['unpaid', 'paid', 'refunded'],
        rustName: 'PayStatus',
        sourceFile: 'types/index.ts',
        note: '🚨 与后端不一致：前端 unpaid，后端 pending',
    },
    {
        tsName: 'BalanceChangeType',
        fields: ['recharge', 'consume', 'refund'],
        rustName: 'BalanceChangeType',
        sourceFile: 'types/index.ts',
        note: '字面量联合类型',
    },
    {
        tsName: 'PaymentMethod',
        fields: ['cash', 'wechat', 'alipay'],
        sourceFile: 'types/index.ts',
        note: '字面量联合类型（仅前端使用）',
    },
    {
        tsName: 'ReturnReason',
        fields: ['质量问题', '数量超出', '保质期', '其他'],
        sourceFile: 'types/index.ts',
        note: '字面量联合类型（中文，前端使用）',
    },
]

/**
 * 通过 TS interface 名查询契约
 */
export function findType(tsName: string): TypeContract | null {
    return FRONTEND_TYPES.find((t) => t.tsName === tsName) ?? null
}
