/**
 * @file 后端 Rust 结构体序列化字段事实清单
 * @description 手工维护后端 #[derive(Serialize/Deserialize)] 结构体经过 serde 处理后的字段名
 *
 * 维护规则：
 * - 每个结构体记录：源名、序列化后字段名清单、rename_all 规则、来源文件
 * - 若结构体有 #[serde(rename_all = "camelCase")]，则字段已转换为 camelCase
 * - 若结构体未声明 rename_all，则字段保持 snake_case（默认）
 * - 单字段 #[serde(rename = "xxx")] 会被记录
 *
 * 数据来源：src-tauri/src/models/*.rs（截至 2026-07-03 v0.3.2）
 */

/** 单个结构体的序列化契约 */
export interface StructContract {
    /** 后端 Rust 结构体名 */
    rustName: string
    /** 对应的前端 TS interface 名（如有） */
    tsName?: string
    /** 序列化后的字段名清单（按 Rust 字段顺序） */
    serializedFields: string[]
    /** serde rename_all 规则 */
    renameAll: 'camelCase' | 'snake_case' | 'lowercase' | 'none'
    /** 是否派生 Serialize（输出） */
    serialize: boolean
    /** 是否派生 Deserialize（输入） */
    deserialize: boolean
    /** 来源文件 */
    sourceFile: string
    /** 备注（如发现潜在问题） */
    note?: string
}

/**
 * 后端所有可序列化/反序列化结构体清单
 *
 * ⚠️ 注意：以下结构体若未声明 rename_all="camelCase"，则字段为 snake_case，
 *         前端必须使用 snake_case 字段名才能正确序列化/反序列化。
 */
export const BACKEND_STRUCTS: StructContract[] = [
    // ========== product.rs - 枚举 ==========
    {
        rustName: 'ProductType',
        tsName: 'ProductType',
        renameAll: 'lowercase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: ['weight', 'count'],
        note: '枚举值（不是字段名），前端 ProductType 字面量需匹配',
    },
    {
        rustName: 'BaseUnit',
        tsName: 'BaseUnit',
        // 通过 #[serde(rename = "g")] 和 #[serde(rename = "pcs")] 单独重命名
        renameAll: 'none',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: ['g', 'pcs'],
        note: '枚举值（不是字段名），通过 #[serde(rename = "xxx")] 单独命名',
    },

    // ========== product.rs - 结构体 ==========
    {
        rustName: 'Product',
        tsName: 'Product',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/product.rs',
        // product_type 字段通过 #[serde(rename = "type")] 单独重命名
        serializedFields: [
            'id', 'code', 'name', 'categoryId', 'type', 'baseUnit',
            'origin', 'year', 'grade', 'fermentationLevel', 'roastLevel',
            'imageUrl', 'defaultUnitId', 'isActive', 'createdAt', 'updatedAt',
        ],
    },
    {
        rustName: 'SalesUnit',
        tsName: 'SalesUnit',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: [
            'id', 'productId', 'name', 'conversionToBase', 'retailPrice',
            'memberPrice', 'sortOrder', 'createdAt', 'updatedAt',
        ],
    },
    {
        rustName: 'PageResult',
        tsName: 'PageResult',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: ['list', 'total', 'page', 'pageSize'],
    },
    {
        rustName: 'ProductInput',
        tsName: 'ProductCreateInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/product.rs',
        // product_type 字段通过 #[serde(rename = "type")] 单独重命名
        serializedFields: [
            'name', 'categoryId', 'type', 'origin', 'year', 'grade',
            'fermentationLevel', 'roastLevel', 'imageUrl', 'units',
        ],
    },
    {
        rustName: 'ProductUpdate',
        tsName: 'ProductUpdateInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: [
            'name', 'categoryId', 'origin', 'year', 'grade',
            'fermentationLevel', 'roastLevel', 'imageUrl', 'isActive', 'units',
        ],
    },
    {
        rustName: 'SalesUnitInput',
        tsName: 'SalesUnitInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/product.rs',
        serializedFields: ['id', 'name', 'conversionToBase', 'retailPrice', 'memberPrice'],
    },

    // ========== category.rs ==========
    {
        rustName: 'Category',
        tsName: 'ProductCategory',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/category.rs',
        serializedFields: ['id', 'name', 'parentId', 'level', 'sortOrder'],
    },
    {
        rustName: 'CategoryInput',
        tsName: 'CategoryInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/category.rs',
        serializedFields: ['name', 'parentId', 'sortOrder'],
    },
    {
        rustName: 'CategoryUpdate',
        tsName: 'CategoryUpdate',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/category.rs',
        serializedFields: ['name', 'parentId', 'sortOrder'],
    },

    // ========== inventory.rs ==========
    {
        rustName: 'InventoryBatch',
        tsName: 'InventoryBatch',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'id', 'productId', 'batchCode', 'purchasePrice', 'totalGrams',
            'remainingGrams', 'supplierId', 'producedDate', 'expireDate', 'createdAt',
        ],
    },
    {
        rustName: 'StockFlow',
        tsName: 'StockFlow',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'id', 'productId', 'batchId', 'flowType', 'changeGrams',
            'balanceGrams', 'orderId', 'remark', 'createdAt',
        ],
    },
    {
        rustName: 'FlowType',
        tsName: 'StockFlowType',
        renameAll: 'snake_case',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['purchaseIn', 'saleOut', 'damageOut', 'returnOut', 'adjustIn', 'adjustOut'],
        note: '枚举值（不是字段名），前端 StockFlowType 字面量需匹配',
    },
    {
        rustName: 'InventoryItem',
        tsName: 'InventoryItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'productId', 'productName', 'categoryName', 'productType',
            'stockGrams', 'stockUnits', 'displayStock',
        ],
    },
    {
        rustName: 'InventoryDetail',
        tsName: 'InventoryDetail',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'productId', 'productName', 'categoryName', 'productType',
            'stockGrams', 'stockUnits', 'batches', 'recentFlows',
        ],
    },
    {
        rustName: 'PurchaseInput',
        tsName: 'PurchaseInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['supplierId', 'handler', 'items', 'remark', 'paymentStatus'],
    },
    {
        rustName: 'PurchaseItemInput',
        tsName: 'PurchaseItemInput',
        // 🔧 v0.3.3 已修复：添加 #[serde(rename_all = "camelCase")]
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['productId', 'unitId', 'quantity', 'unitPrice'],
        note: '🔧 v0.3.3 已修复：添加 #[serde(rename_all = "camelCase")]，与前端字段一致',
    },
    {
        rustName: 'PurchaseOrder',
        tsName: 'PurchaseOrder',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'handler',
            'totalAmount', 'paymentStatus', 'remark', 'items', 'createdAt',
        ],
    },
    {
        rustName: 'PurchaseOrderItem',
        tsName: 'PurchaseOrderItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'productId', 'productName', 'unitId', 'unitName', 'quantity',
            'grams', 'unitPrice', 'subtotal', 'batchId', 'batchCode',
        ],
    },
    {
        rustName: 'PurchaseOrderListItem',
        tsName: 'PurchaseOrderListItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'handler',
            'totalAmount', 'paymentStatus', 'itemCount', 'remark', 'createdAt',
        ],
    },
    {
        rustName: 'AdjustInput',
        tsName: 'AdjustInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['productId', 'grams', 'remark'],
    },
    {
        rustName: 'DamageOutInput',
        tsName: 'DamageOutInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['productId', 'grams', 'remark'],
    },
    {
        rustName: 'StockChangeResult',
        tsName: 'StockChangeResult',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/inventory.rs',
        serializedFields: ['success', 'productId', 'changeGrams', 'newBalance', 'flowId'],
    },

    // ========== sales.rs ==========
    {
        rustName: 'MemberLevel',
        tsName: 'MemberLevel',
        renameAll: 'lowercase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['normal', 'silver', 'gold'],
        note: '枚举值（不是字段名），前端 MemberLevel 字面量需匹配',
    },
    {
        rustName: 'Member',
        tsName: 'Member',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: [
            'id', 'name', 'phone', 'gender', 'birthday', 'level', 'points',
            'balance', 'totalConsume', 'consumeCount', 'lastVisit', 'createdAt',
        ],
    },
    {
        rustName: 'MemberInput',
        tsName: 'MemberInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['name', 'phone', 'gender', 'birthday'],
    },
    {
        rustName: 'MemberUpdate',
        tsName: 'MemberUpdate',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['name', 'gender', 'birthday', 'level'],
    },
    {
        rustName: 'SaleOrderInput',
        tsName: 'SaleOrderInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['items', 'memberId', 'pointsDeduct', 'payMethod', 'remark'],
    },
    {
        rustName: 'SaleItemInput',
        tsName: 'SaleItemInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['productId', 'unitId', 'quantity'],
    },
    {
        rustName: 'SaleOrder',
        tsName: 'SaleOrder',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: [
            'id', 'orderNo', 'memberId', 'memberName', 'totalAmount',
            'discountAmount', 'pointsDeduct', 'pointsEarned', 'actualAmount',
            'payMethod', 'payStatus', 'status', 'remark', 'items', 'createdAt',
        ],
    },
    {
        rustName: 'SaleOrderItem',
        tsName: 'SaleOrderItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        // 注意：后端没有 unitId 字段，前端 SaleOrderItem 有 unitId 字段
        serializedFields: [
            'id', 'orderId', 'productId', 'productName', 'unitName',
            'quantity', 'unitPrice', 'grams', 'subtotal',
        ],
        note: '前端 SaleOrderItem 多了 unitId 字段（后端无此字段，但不影响序列化）',
    },
    {
        rustName: 'PayMethod',
        tsName: 'PayMethod',
        // 🔧 v0.3.3 已修复：MemberCard 序列化为 "memberBalance"，Mixed 序列化为 "combined"
        renameAll: 'none',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['cash', 'wechat', 'alipay', 'memberBalance', 'combined'],
        note: '🔧 v0.3.3 已修复：枚举值与前端 PayMethod 类型一致',
    },
    {
        rustName: 'PayStatus',
        tsName: 'PayStatus',
        // 🔧 v0.3.3 已修复：Pending 序列化为 "unpaid"
        renameAll: 'none',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['unpaid', 'paid', 'refunded'],
        note: '🔧 v0.3.3 已修复：Pending 序列化为 "unpaid"，与前端 PayStatus 类型一致',
    },
    {
        rustName: 'OrderStatus',
        tsName: 'SaleOrderStatus',
        renameAll: 'snake_case',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['pending', 'completed', 'cancelled'],
    },
    {
        rustName: 'HeldOrder',
        tsName: 'HeldOrder',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['id', 'orderNo', 'memberName', 'itemCount', 'totalAmount', 'createdAt'],
    },
    {
        rustName: 'MemberPreference',
        tsName: 'MemberPreference',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: [
            'memberId', 'preferredTeas', 'tastePreferences', 'taboos',
            'brewHabits', 'consumptionScenario', 'remark',
        ],
    },
    {
        rustName: 'MemberPreferenceInput',
        tsName: 'MemberPreferenceInput',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: [
            'preferredTeas', 'tastePreferences', 'taboos',
            'brewHabits', 'consumptionScenario', 'remark',
        ],
    },
    {
        rustName: 'MemberDetail',
        tsName: 'MemberDetail',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['member', 'preference'],
    },
    {
        rustName: 'MemberConsumptionItem',
        tsName: 'MemberConsumptionItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['orderId', 'orderNo', 'totalAmount', 'pointsEarned', 'pointsDeduct', 'createdAt'],
    },
    {
        rustName: 'MemberConsumption',
        tsName: 'MemberConsumption',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/sales.rs',
        serializedFields: ['memberId', 'totalConsume', 'consumeCount', 'records'],
    },

    // ========== supplier.rs ==========
    {
        rustName: 'Supplier',
        tsName: 'Supplier',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/supplier.rs',
        serializedFields: [
            'id', 'name', 'contactPerson', 'contactPhone', 'address',
            'mainCategories', 'remark', 'isActive', 'createdAt', 'updatedAt',
        ],
    },
    {
        rustName: 'SupplierInput',
        tsName: 'SupplierInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/supplier.rs',
        serializedFields: ['name', 'contactPerson', 'contactPhone', 'address', 'mainCategories', 'remark'],
    },

    // ========== return_order.rs ==========
    {
        rustName: 'ReturnItemInput',
        tsName: 'ReturnItemInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/return_order.rs',
        serializedFields: ['productId', 'unitId', 'batchId', 'quantity'],
    },
    {
        rustName: 'ReturnOrderInput',
        tsName: 'ReturnOrderInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/return_order.rs',
        serializedFields: ['supplierId', 'returnDate', 'returnReason', 'remark', 'items'],
    },
    {
        rustName: 'ReturnOrderItem',
        tsName: 'ReturnOrderItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/return_order.rs',
        serializedFields: [
            'id', 'orderId', 'productId', 'productName', 'unitId', 'unitName',
            'batchId', 'batchCode', 'quantity', 'unitPrice', 'grams', 'subtotal',
        ],
    },
    {
        rustName: 'ReturnOrder',
        tsName: 'ReturnOrder',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/return_order.rs',
        serializedFields: [
            'id', 'orderNo', 'supplierId', 'supplierName', 'returnDate',
            'returnReason', 'totalAmount', 'remark', 'items', 'createdAt',
        ],
    },
    {
        rustName: 'ReturnOrderListItem',
        tsName: 'ReturnOrderListItem',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/return_order.rs',
        serializedFields: [
            'id', 'orderNo', 'supplierName', 'returnDate', 'returnReason',
            'totalAmount', 'itemCount', 'createdAt',
        ],
    },
    {
        rustName: 'BatchOption',
        tsName: 'BatchOption',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/return_order.rs',
        serializedFields: ['id', 'batchCode', 'remainingGrams', 'purchasePrice', 'createdAt'],
    },

    // ========== member_balance.rs ==========
    {
        rustName: 'BalanceChangeType',
        tsName: 'BalanceChangeType',
        renameAll: 'lowercase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/member_balance.rs',
        serializedFields: ['recharge', 'consume', 'refund'],
        note: '枚举值（不是字段名），前端 BalanceChangeType 字面量需匹配',
    },
    {
        rustName: 'BalanceLog',
        tsName: 'BalanceLog',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: true,
        sourceFile: 'models/member_balance.rs',
        serializedFields: [
            'id', 'memberId', 'changeType', 'changeAmount', 'balanceAfter',
            'paymentMethod', 'operator', 'relatedOrderId', 'bonusAmount',
            'feeAmount', 'remark', 'createdAt',
        ],
    },
    {
        rustName: 'RechargeInput',
        tsName: 'RechargeInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/member_balance.rs',
        serializedFields: ['memberId', 'amount', 'paymentMethod', 'operator', 'remark', 'bonusAmount'],
    },
    {
        rustName: 'RechargeResult',
        tsName: 'RechargeResult',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/member_balance.rs',
        serializedFields: ['logId', 'newBalance', 'createdAt'],
    },
    {
        rustName: 'RefundInput',
        tsName: 'RefundInput',
        renameAll: 'camelCase',
        serialize: false,
        deserialize: true,
        sourceFile: 'models/member_balance.rs',
        serializedFields: ['memberId', 'amount', 'paymentMethod', 'operator', 'remark'],
    },
    {
        rustName: 'RefundResult',
        tsName: 'RefundResult',
        renameAll: 'camelCase',
        serialize: true,
        deserialize: false,
        sourceFile: 'models/member_balance.rs',
        serializedFields: ['logId', 'newBalance', 'createdAt'],
    },
]

/**
 * 通过 Rust 结构体名查询契约
 */
export function findStruct(rustName: string): StructContract | null {
    return BACKEND_STRUCTS.find((s) => s.rustName === rustName) ?? null
}

/**
 * 通过 TS interface 名查询契约
 */
export function findStructByTsName(tsName: string): StructContract | null {
    return BACKEND_STRUCTS.find((s) => s.tsName === tsName) ?? null
}
