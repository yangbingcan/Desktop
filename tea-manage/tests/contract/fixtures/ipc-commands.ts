/**
 * @file 后端 Tauri 命令事实清单
 * @description 手工维护的后端 #[tauri::command] 函数签名元数据
 *
 * 维护规则：
 * - 每次后端新增/修改/删除 #[tauri::command] 时，必须同步更新本文件
 * - 字段名必须与后端 Rust 函数参数名完全一致（snake_case）
 * - 不包含 db: tauri::State<'_, Database>（Tauri 自动注入，前端无需传）
 * - required 标记非 Option<T> 类型的参数（前端必须传）
 *
 * 数据来源：src-tauri/src/commands/*.rs（截至 2026-07-03 v0.3.2）
 */

/** 单个命令的契约元数据 */
export interface CommandContract {
    /** 命令名（与 #[tauri::command] 函数名一致，snake_case） */
    name: string
    /** 后端参数列表（不含 db: State） */
    params: CommandParam[]
    /** 所属模块（用于诊断） */
    module: string
    /** 来源文件（相对于 src-tauri/src/） */
    sourceFile: string
}

/** 单个参数的契约元数据 */
export interface CommandParam {
    /** 参数名（snake_case，与后端 Rust 函数参数名完全一致） */
    name: string
    /** 是否必传（Option<T> 类型为 false） */
    required: boolean
    /** 参数类型描述（用于诊断） */
    type: string
}

/**
 * 后端全部 47 个 Tauri 命令的事实清单
 *
 * 验证方法：与 src-tauri/src/lib.rs 的 invoke_handler 注册列表一一对应
 */
export const BACKEND_COMMANDS: CommandContract[] = [
    // ========== 商品相关（products.rs） ==========
    {
        name: 'get_products',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [
            { name: 'page', required: false, type: 'Option<u32>' },
            { name: 'page_size', required: false, type: 'Option<u32>' },
            { name: 'category_id', required: false, type: 'Option<String>' },
            { name: 'product_type', required: false, type: 'Option<String>' },
            { name: 'keyword', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_product',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [{ name: 'id', required: true, type: 'String' }],
    },
    {
        name: 'create_product',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [{ name: 'product', required: true, type: 'ProductInput' }],
    },
    {
        name: 'update_product',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [
            { name: 'id', required: true, type: 'String' },
            { name: 'update', required: true, type: 'ProductUpdate' },
        ],
    },
    {
        name: 'delete_product',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [{ name: 'id', required: true, type: 'String' }],
    },
    {
        name: 'get_product_units',
        module: 'products',
        sourceFile: 'commands/products.rs',
        params: [{ name: 'product_id', required: true, type: 'String' }],
    },

    // ========== 分类相关（categories.rs） ==========
    {
        name: 'get_categories',
        module: 'categories',
        sourceFile: 'commands/categories.rs',
        params: [],
    },
    {
        name: 'create_category',
        module: 'categories',
        sourceFile: 'commands/categories.rs',
        params: [{ name: 'category', required: true, type: 'CategoryInput' }],
    },
    {
        name: 'update_category',
        module: 'categories',
        sourceFile: 'commands/categories.rs',
        params: [
            { name: 'id', required: true, type: 'String' },
            { name: 'update', required: true, type: 'CategoryUpdate' },
        ],
    },
    {
        name: 'delete_category',
        module: 'categories',
        sourceFile: 'commands/categories.rs',
        params: [{ name: 'id', required: true, type: 'String' }],
    },

    // ========== 库存相关（inventory.rs） ==========
    {
        name: 'get_inventory',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'category_id', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_inventory_detail',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [{ name: 'product_id', required: true, type: 'String' }],
    },
    {
        name: 'get_stock_flows',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [
            { name: 'product_id', required: true, type: 'String' },
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
        ],
    },
    {
        name: 'purchase_in',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [{ name: 'input', required: true, type: 'PurchaseInput' }],
    },
    {
        name: 'damage_out',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [{ name: 'input', required: true, type: 'DamageOutInput' }],
    },
    {
        name: 'adjust_stock',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [{ name: 'input', required: true, type: 'AdjustInput' }],
    },

    // ========== 采购入库（inventory.rs，v0.3.0） ==========
    {
        name: 'get_purchase_orders',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'supplier_id', required: false, type: 'Option<String>' },
            { name: 'payment_status', required: false, type: 'Option<String>' },
            { name: 'date_start', required: false, type: 'Option<String>' },
            { name: 'date_end', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_purchase_order_detail',
        module: 'inventory',
        sourceFile: 'commands/inventory.rs',
        params: [{ name: 'order_id', required: true, type: 'String' }],
    },

    // ========== 销售相关（sales.rs） ==========
    {
        name: 'get_member_by_phone',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'phone', required: true, type: 'String' }],
    },
    {
        name: 'create_member',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [
            { name: 'name', required: true, type: 'String' },
            { name: 'phone', required: true, type: 'String' },
            { name: 'gender', required: false, type: 'Option<String>' },
            { name: 'birthday', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'update_member',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [
            { name: 'member_id', required: true, type: 'String' },
            { name: 'name', required: true, type: 'String' },
            { name: 'phone', required: true, type: 'String' },
            { name: 'gender', required: false, type: 'Option<String>' },
            { name: 'birthday', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_members',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'keyword', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_member_detail',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'member_id', required: true, type: 'String' }],
    },
    {
        name: 'update_member_preference',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [
            { name: 'member_id', required: true, type: 'String' },
            { name: 'input', required: true, type: 'MemberPreferenceInput' },
        ],
    },
    {
        name: 'get_member_consumption',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'member_id', required: true, type: 'String' }],
    },
    {
        name: 'create_sale_order',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'input', required: true, type: 'SaleOrderInput' }],
    },
    {
        name: 'hold_order',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'input', required: true, type: 'SaleOrderInput' }],
    },
    {
        name: 'get_held_orders',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [],
    },
    {
        name: 'get_held_order_detail',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'order_id', required: true, type: 'String' }],
    },
    {
        name: 'delete_held_order',
        module: 'sales',
        sourceFile: 'commands/sales.rs',
        params: [{ name: 'order_id', required: true, type: 'String' }],
    },

    // ========== 供应商（suppliers.rs） ==========
    {
        name: 'get_suppliers',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'keyword', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_all_active_suppliers',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [],
    },
    {
        name: 'get_supplier',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [{ name: 'id', required: true, type: 'String' }],
    },
    {
        name: 'create_supplier',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [{ name: 'input', required: true, type: 'SupplierInput' }],
    },
    {
        name: 'update_supplier',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [
            { name: 'id', required: true, type: 'String' },
            { name: 'input', required: true, type: 'SupplierInput' },
        ],
    },
    {
        name: 'delete_supplier',
        module: 'suppliers',
        sourceFile: 'commands/suppliers.rs',
        params: [{ name: 'id', required: true, type: 'String' }],
    },

    // ========== 退货出库（return_order.rs） ==========
    {
        name: 'get_available_batches',
        module: 'return_order',
        sourceFile: 'commands/return_order.rs',
        params: [{ name: 'product_id', required: true, type: 'String' }],
    },
    {
        name: 'create_return_order',
        module: 'return_order',
        sourceFile: 'commands/return_order.rs',
        params: [{ name: 'input', required: true, type: 'ReturnOrderInput' }],
    },
    {
        name: 'get_return_orders',
        module: 'return_order',
        sourceFile: 'commands/return_order.rs',
        params: [
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'supplier_id', required: false, type: 'Option<String>' },
            { name: 'return_reason', required: false, type: 'Option<String>' },
            { name: 'date_start', required: false, type: 'Option<String>' },
            { name: 'date_end', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_return_order_detail',
        module: 'return_order',
        sourceFile: 'commands/return_order.rs',
        params: [{ name: 'order_id', required: true, type: 'String' }],
    },
    {
        name: 'delete_return_order',
        module: 'return_order',
        sourceFile: 'commands/return_order.rs',
        params: [{ name: 'order_id', required: true, type: 'String' }],
    },

    // ========== 储值余额（members.rs，v0.3.1 M06） ==========
    {
        name: 'recharge_member_balance',
        module: 'member_balance',
        sourceFile: 'commands/members.rs',
        params: [{ name: 'input', required: true, type: 'RechargeInput' }],
    },
    {
        name: 'refund_member_balance',
        module: 'member_balance',
        sourceFile: 'commands/members.rs',
        params: [{ name: 'input', required: true, type: 'RefundInput' }],
    },
    {
        name: 'get_member_balance_logs',
        module: 'member_balance',
        sourceFile: 'commands/members.rs',
        params: [
            { name: 'member_id', required: true, type: 'String' },
            { name: 'page', required: false, type: 'Option<i64>' },
            { name: 'page_size', required: false, type: 'Option<i64>' },
            { name: 'change_type', required: false, type: 'Option<String>' },
        ],
    },
    {
        name: 'get_member_last_payment_method',
        module: 'member_balance',
        sourceFile: 'commands/members.rs',
        params: [{ name: 'member_id', required: true, type: 'String' }],
    },

    // ========== 开发辅助（dev_data.rs） ==========
    {
        name: 'seed_demo_data',
        module: 'dev',
        sourceFile: 'commands/dev_data.rs',
        params: [],
    },
    {
        name: 'clear_all_data',
        module: 'dev',
        sourceFile: 'commands/dev_data.rs',
        params: [],
    },
]

/**
 * 通过命令名查询契约
 * @returns 命令契约，找不到返回 null
 */
export function findCommand(name: string): CommandContract | null {
    return BACKEND_COMMANDS.find((c) => c.name === name) ?? null
}

/** 所有已注册命令名清单（用于"命令名存在性"校验） */
export const REGISTERED_COMMAND_NAMES: string[] = BACKEND_COMMANDS.map((c) => c.name)
