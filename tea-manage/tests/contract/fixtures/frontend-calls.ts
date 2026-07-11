/**
 * @file 前端 invoke 调用事实清单
 * @description 手工维护的前端 invoke() 调用元数据
 *
 * 维护规则：
 * - 每次前端新增/修改/删除 invoke() 调用时，必须同步更新本文件
 * - keys 数组记录 invoke 第二个参数对象的全部 key（按字母序）
 * - 当 invoke 第二个参数省略时，keys 为空数组
 *
 * 数据来源：src/api/*.ts（截至 2026-07-03 v0.3.2）
 *
 * ⚠️ 重要：本文件是"现状记录"，不是"应然规范"。
 *    契约测试会比较 keys 与后端 BACKEND_COMMANDS 的 params，
 *    发现命名风格不一致（camelCase vs snake_case）即报告缺陷。
 */

/** 单个前端 invoke 调用的元数据 */
export interface FrontendCall {
    /** 调用的 Tauri 命令名 */
    command: string
    /** invoke() 第二个参数对象的全部 key（按字母序） */
    keys: string[]
    /** 来源文件（相对于 src/） */
    sourceFile: string
    /** 所在的导出函数名（用于诊断） */
    functionName: string
    /** 调用所在行号（用于诊断） */
    line: number
}

/**
 * 前端全部 47 个 invoke 调用的事实清单
 *
 * 验证方法：与 src/api/*.ts 中的 invoke() 调用一一对应
 */
export const FRONTEND_CALLS: FrontendCall[] = [
    // ========== products.ts ==========
    {
        command: 'get_products',
        keys: ['page', 'pageSize'],
        sourceFile: 'api/products.ts',
        functionName: 'getProducts',
        line: 16,
    },
    {
        command: 'get_product',
        keys: ['id'],
        sourceFile: 'api/products.ts',
        functionName: 'getProduct',
        line: 27,
    },
    {
        command: 'create_product',
        keys: ['product'],
        sourceFile: 'api/products.ts',
        functionName: 'createProduct',
        line: 34,
    },
    {
        command: 'update_product',
        keys: ['id', 'update'],
        sourceFile: 'api/products.ts',
        functionName: 'updateProduct',
        line: 42,
    },
    {
        command: 'delete_product',
        keys: ['id'],
        sourceFile: 'api/products.ts',
        functionName: 'deleteProduct',
        line: 49,
    },
    {
        command: 'get_product_units',
        keys: ['productId'],
        sourceFile: 'api/products.ts',
        functionName: 'getProductUnits',
        line: 63,
    },
    {
        command: 'get_products',
        keys: ['keyword', 'page', 'pageSize'],
        sourceFile: 'api/products.ts',
        functionName: 'searchProducts',
        line: 71,
    },
    {
        command: 'get_categories',
        keys: [],
        sourceFile: 'api/products.ts',
        functionName: 'getCategories',
        line: 83,
    },
    {
        command: 'create_category',
        keys: ['category'],
        sourceFile: 'api/products.ts',
        functionName: 'createCategory',
        line: 92,
    },
    {
        command: 'update_category',
        keys: ['id', 'update'],
        sourceFile: 'api/products.ts',
        functionName: 'updateCategory',
        line: 103,
    },
    {
        command: 'delete_category',
        keys: ['id'],
        sourceFile: 'api/products.ts',
        functionName: 'deleteCategory',
        line: 110,
    },

    // ========== inventory.ts ==========
    {
        command: 'get_inventory',
        keys: ['categoryId', 'page', 'pageSize'],
        sourceFile: 'api/inventory.ts',
        functionName: 'getInventory',
        line: 22,
    },
    {
        command: 'get_inventory_detail',
        keys: ['productId'],
        sourceFile: 'api/inventory.ts',
        functionName: 'getInventoryDetail',
        line: 35,
    },
    {
        command: 'get_stock_flows',
        keys: ['page', 'pageSize', 'productId'],
        sourceFile: 'api/inventory.ts',
        functionName: 'getStockFlows',
        line: 48,
    },
    {
        command: 'purchase_in',
        keys: ['input'],
        sourceFile: 'api/inventory.ts',
        functionName: 'purchaseIn',
        line: 59,
    },
    {
        command: 'damage_out',
        keys: ['input'],
        sourceFile: 'api/inventory.ts',
        functionName: 'damageOut',
        line: 66,
    },
    {
        command: 'adjust_stock',
        keys: ['input'],
        sourceFile: 'api/inventory.ts',
        functionName: 'adjustStock',
        line: 73,
    },

    // ========== purchases.ts ==========
    {
        command: 'get_purchase_orders',
        keys: ['dateEnd', 'dateStart', 'page', 'pageSize', 'paymentStatus', 'supplierId'],
        sourceFile: 'api/purchases.ts',
        functionName: 'getPurchaseOrders',
        line: 29,
    },
    {
        command: 'get_purchase_order_detail',
        keys: ['orderId'],
        sourceFile: 'api/purchases.ts',
        functionName: 'getPurchaseOrderDetail',
        line: 45,
    },

    // ========== returnOrders.ts ==========
    {
        command: 'get_available_batches',
        keys: ['productId'],
        sourceFile: 'api/returnOrders.ts',
        functionName: 'getAvailableBatches',
        line: 17,
    },
    {
        command: 'create_return_order',
        keys: ['input'],
        sourceFile: 'api/returnOrders.ts',
        functionName: 'createReturnOrder',
        line: 24,
    },
    {
        command: 'get_return_orders',
        keys: ['dateEnd', 'dateStart', 'page', 'pageSize', 'returnReason', 'supplierId'],
        sourceFile: 'api/returnOrders.ts',
        functionName: 'getReturnOrders',
        line: 43,
    },
    {
        command: 'get_return_order_detail',
        keys: ['orderId'],
        sourceFile: 'api/returnOrders.ts',
        functionName: 'getReturnOrderDetail',
        line: 59,
    },
    {
        command: 'delete_return_order',
        keys: ['orderId'],
        sourceFile: 'api/returnOrders.ts',
        functionName: 'deleteReturnOrder',
        line: 68,
    },

    // ========== suppliers.ts ==========
    {
        command: 'get_suppliers',
        keys: ['keyword', 'page', 'pageSize'],
        sourceFile: 'api/suppliers.ts',
        functionName: 'getSuppliers',
        line: 18,
    },
    {
        command: 'get_all_active_suppliers',
        keys: [],
        sourceFile: 'api/suppliers.ts',
        functionName: 'getAllActiveSuppliers',
        line: 29,
    },
    {
        command: 'get_supplier',
        keys: ['id'],
        sourceFile: 'api/suppliers.ts',
        functionName: 'getSupplier',
        line: 36,
    },
    {
        command: 'create_supplier',
        keys: ['input'],
        sourceFile: 'api/suppliers.ts',
        functionName: 'createSupplier',
        line: 43,
    },
    {
        command: 'update_supplier',
        keys: ['id', 'input'],
        sourceFile: 'api/suppliers.ts',
        functionName: 'updateSupplier',
        line: 50,
    },
    {
        command: 'delete_supplier',
        keys: ['id'],
        sourceFile: 'api/suppliers.ts',
        functionName: 'deleteSupplier',
        line: 57,
    },

    // ========== sales.ts ==========
    {
        command: 'get_member_by_phone',
        keys: ['phone'],
        sourceFile: 'api/sales.ts',
        functionName: 'getMemberByPhone',
        line: 19,
    },
    {
        command: 'create_member',
        keys: ['birthday', 'gender', 'name', 'phone'],
        sourceFile: 'api/sales.ts',
        functionName: 'createMember',
        line: 31,
    },
    {
        command: 'create_sale_order',
        keys: ['input'],
        sourceFile: 'api/sales.ts',
        functionName: 'createSaleOrder',
        line: 38,
    },
    {
        command: 'hold_order',
        keys: ['input'],
        sourceFile: 'api/sales.ts',
        functionName: 'holdOrder',
        line: 45,
    },
    {
        command: 'get_held_orders',
        keys: [],
        sourceFile: 'api/sales.ts',
        functionName: 'getHeldOrders',
        line: 52,
    },
    {
        command: 'get_held_order_detail',
        keys: ['orderId'],
        sourceFile: 'api/sales.ts',
        functionName: 'getHeldOrderDetail',
        line: 61,
    },
    {
        command: 'delete_held_order',
        keys: ['orderId'],
        sourceFile: 'api/sales.ts',
        functionName: 'deleteHeldOrder',
        line: 70,
    },

    // ========== members.ts ==========
    {
        command: 'get_members',
        keys: ['keyword', 'page', 'pageSize'],
        sourceFile: 'api/members.ts',
        functionName: 'getMembers',
        line: 25,
    },
    {
        command: 'get_member_by_phone',
        keys: ['phone'],
        sourceFile: 'api/members.ts',
        functionName: 'getMemberByPhone',
        line: 36,
    },
    {
        command: 'create_member',
        keys: ['birthday', 'gender', 'name', 'phone'],
        sourceFile: 'api/members.ts',
        functionName: 'createMember',
        line: 48,
    },
    {
        command: 'update_member',
        keys: ['birthday', 'gender', 'memberId', 'name', 'phone'],
        sourceFile: 'api/members.ts',
        functionName: 'updateMember',
        line: 63,
    },
    {
        command: 'get_member_detail',
        keys: ['memberId'],
        sourceFile: 'api/members.ts',
        functionName: 'getMemberDetail',
        line: 72,
    },
    {
        command: 'update_member_preference',
        keys: ['input', 'memberId'],
        sourceFile: 'api/members.ts',
        functionName: 'updateMemberPreference',
        line: 84,
    },
    {
        command: 'get_member_consumption',
        keys: ['memberId'],
        sourceFile: 'api/members.ts',
        functionName: 'getMemberConsumption',
        line: 93,
    },
    {
        command: 'recharge_member_balance',
        keys: ['input'],
        sourceFile: 'api/members.ts',
        functionName: 'rechargeMemberBalance',
        line: 172,
    },
    {
        command: 'refund_member_balance',
        keys: ['input'],
        sourceFile: 'api/members.ts',
        functionName: 'refundMemberBalance',
        line: 181,
    },
    {
        command: 'get_member_balance_logs',
        keys: ['changeType', 'memberId', 'page', 'pageSize'],
        sourceFile: 'api/members.ts',
        functionName: 'getMemberBalanceLogs',
        line: 200,
    },
    {
        command: 'get_member_last_payment_method',
        keys: ['memberId'],
        sourceFile: 'api/members.ts',
        functionName: 'getMemberLastPaymentMethod',
        line: 216,
    },

    // ========== dev.ts ==========
    {
        command: 'seed_demo_data',
        keys: [],
        sourceFile: 'api/dev.ts',
        functionName: 'seedDemoData',
        line: 23,
    },
    {
        command: 'clear_all_data',
        keys: [],
        sourceFile: 'api/dev.ts',
        functionName: 'clearAllData',
        line: 28,
    },
]
