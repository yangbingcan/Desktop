/**
 * @file E2E 测试 mock Tauri API 辅助函数
 * @description 在浏览器中注入 mock @tauri-apps/api/core 的 invoke
 *              使前端在无需 Tauri 后端的情况下正常运行
 *
 * 工作原理：
 * - 通过 page.addInitScript 在页面加载前注入脚本
 * - 设置 window.isTauri = true（isTauri() 检查此值）
 * - 覆盖 window.__TAURI_INTERNALS__.invoke 函数
 * - 根据 command 名称返回预设的 mock 数据
 *
 * 重要：addInitScript 的参数只能传递可序列化数据（不能传递函数）
 * 因此所有 mock 数据和路由逻辑必须内联在注入函数中
 */
import type { Page } from '@playwright/test'

/**
 * mock 数据生成函数（供测试断言使用，导出给测试文件引用）
 */
export const mockData = {
    products: [
        { id: 'p-001', code: 'LONGJING001', name: '西湖龙井', categoryId: 'c-001', type: 'weight', baseUnit: 'g', isActive: true, createdAt: '2026-01-01' },
        { id: 'p-002', code: 'BILUOCHUN001', name: '碧螺春', categoryId: 'c-001', type: 'weight', baseUnit: 'g', isActive: true, createdAt: '2026-01-02' }
    ],
    categories: [
        { id: 'c-001', name: '绿茶', parentId: null, sortOrder: 1, createdAt: '2026-01-01' },
        { id: 'c-002', name: '红茶', parentId: null, sortOrder: 2, createdAt: '2026-01-01' }
    ],
    members: [
        { id: 'm-001', name: '张三', phone: '13800138000', gender: 'male', birthday: null, level: 'gold', points: 1000, balance: 500, totalConsume: 5000, consumeCount: 10, lastVisit: '2026-06-01', createdAt: '2026-01-01' }
    ],
    saleOrder: {
        id: 'so-001', orderNo: 'XS20260703143000001', memberId: null, memberName: null,
        totalAmount: 100, discountAmount: 0, pointsDeduct: 0, pointsEarned: 100, actualAmount: 100,
        payMethod: 'cash', payStatus: 'paid', status: 'completed', remark: null, items: [], createdAt: '2026-07-03 14:30:00'
    }
}

/**
 * 注入 mock Tauri API 到浏览器
 *
 * 在每个页面加载前调用，覆盖 Tauri 的 invoke 函数
 * 使前端代码在浏览器中正常运行（无需 Tauri 后端）
 *
 * @param page Playwright Page 对象
 * @param overrides 命令级别的 mock 覆盖（可选，用于特定测试场景）
 *                  注意：override 值必须是可序列化的数据（不能是函数）
 */
export async function injectMockTauri(page: Page, overrides: Record<string, any> = {}) {
    // 将 mock 数据序列化为字符串，内联到注入脚本中
    // 注意：addInitScript 的参数只能传递可序列化数据，不能传递函数
    const script = `
        // ===== 设置 isTauri 标志 =====
        window.isTauri = true;

        // ===== 模拟已登录态（绕过 router 守卫的登录门禁） =====
        // 仅用于 E2E 测试；真实运行由 Login.vue 在登录成功后设置该标志。
        // v0.7.1 回归修复：此前未设置此标志导致所有非公开路由被守卫重定向到 /login，
        // 使 E2E 用例永远停留在登录页而断言失败。
        try { localStorage.setItem('tea-logged-in', '1'); } catch (e) {}

        // ===== mock 数据（与 mockData 导出保持一致） =====
        var PRODUCTS = ${JSON.stringify(mockData.products)};
        var CATEGORIES = ${JSON.stringify(mockData.categories)};
        var MEMBERS = ${JSON.stringify(mockData.members)};
        var SALE_ORDER = ${JSON.stringify(mockData.saleOrder)};
        var OVERRIDES = ${JSON.stringify(overrides)};

        // ===== mock 销售单位 =====
        function mockSalesUnits(productId) {
            return [
                { id: 'u-001', productId: productId, name: '50g', conversionToBase: 50, retailPrice: 100, isActive: true },
                { id: 'u-002', productId: productId, name: '100g', conversionToBase: 100, retailPrice: 180, isActive: true }
            ];
        }

        // ===== mock 路由表 =====
        var ROUTES = {
            // 商品相关
            get_products: function() {
                return { list: PRODUCTS, total: PRODUCTS.length, page: 1, pageSize: 100 };
            },
            get_product: function(args) {
                return PRODUCTS.find(function(p) { return p.id === args.id; }) || PRODUCTS[0];
            },
            create_product: function(args) { return Object.assign(args, { id: 'p-new', createdAt: '2026-07-03' }); },
            update_product: function(args) { return Object.assign(args, { updatedAt: '2026-07-03' }); },
            delete_product: function() { return true; },
            get_product_units: function(args) { return mockSalesUnits(args.productId || 'p-001'); },

            // 分类相关
            get_categories: function() { return CATEGORIES; },
            create_category: function(args) { return Object.assign(args, { id: 'c-new' }); },
            update_category: function(args) { return args; },
            delete_category: function() { return true; },

            // 库存相关
            get_inventory: function() {
                return {
                    list: [{
                        productId: 'p-001', productName: '西湖龙井', productCode: 'LONGJING001',
                        categoryId: 'c-001', categoryName: '绿茶', productType: 'weight',
                        stockGrams: 1000, stockValue: 2000, displayStock: '1000 g',
                        batchCount: 2, updatedAt: '2026-07-01'
                    }],
                    total: 1, page: 1, pageSize: 20
                };
            },
            get_inventory_detail: function(args) {
                return {
                    product: PRODUCTS[0],
                    batches: [
                        { id: 'b-001', productId: args.productId || 'p-001', batchCode: 'BN20260101', remainingGrams: 500, initialGrams: 500, createdAt: '2026-01-01' },
                        { id: 'b-002', productId: args.productId || 'p-001', batchCode: 'BN20260115', remainingGrams: 500, initialGrams: 500, createdAt: '2026-01-15' }
                    ],
                    flows: []
                };
            },
            get_stock_flows: function() { return { list: [], total: 0, page: 1, pageSize: 20 }; },
            purchase_in: function(args) { return Object.assign(args, { id: 'po-new', status: 'completed' }); },
            get_purchase_orders: function() {
                return {
                    list: [{
                        id: 'po-001', orderNo: 'RK20260701001', supplierId: 's-001',
                        supplierName: '杭州茶厂', totalAmount: 1000, itemCount: 2, status: 'completed',
                        remark: null, createdAt: '2026-07-01 10:00:00'
                    }],
                    total: 1, page: 1, pageSize: 20
                };
            },
            get_purchase_order_detail: function() { return null; },

            // 销售相关
            get_member_by_phone: function() { return null; },
            create_member: function(args) { return Object.assign(args, { id: 'm-new', level: 'normal', points: 0, balance: 0 }); },
            create_sale_order: function() { return SALE_ORDER; },
            hold_order: function(args) { return Object.assign(args, { id: 'held-new' }); },
            get_held_orders: function() { return []; },
            get_held_order_detail: function() { return null; },
            delete_held_order: function() { return true; },

            // 会员相关
            get_members: function() {
                return { list: MEMBERS, total: MEMBERS.length, page: 1, pageSize: 20 };
            },
            get_member_detail: function() { return null; },
            get_member_consumption: function() {
                return { memberId: 'm-001', totalConsume: 5000, consumeCount: 10, records: [] };
            },
            update_member_preference: function() { return true; },

            // 供应商相关
            get_suppliers: function() {
                return {
                    list: [{
                        id: 's-001', name: '杭州茶厂', contactPerson: '王经理', phone: '0571-12345678',
                        address: '杭州市西湖区', remark: null, isActive: true, createdAt: '2026-01-01'
                    }],
                    total: 1, page: 1, pageSize: 20
                };
            },
            get_all_active_suppliers: function() {
                return [{
                    id: 's-001', name: '杭州茶厂', contactPerson: '王经理', phone: '0571-12345678',
                    address: '杭州市西湖区', remark: null, isActive: true, createdAt: '2026-01-01'
                }];
            },
            get_supplier: function(args) {
                return {
                    id: args.id || 's-001', name: '杭州茶厂', contactPerson: '王经理', phone: '0571-12345678',
                    address: '杭州市西湖区', remark: null, isActive: true, createdAt: '2026-01-01'
                };
            },

            // 设置相关
            get_settings: function() {
                return {
                    shopName: '测试茶店', shopAddress: '测试地址', shopPhone: '13800000000',
                    receiptHeader: '欢迎光临', receiptFooter: '谢谢惠顾', printAuto: false, printCopies: 1
                };
            },
            save_settings: function() { return true; },

            // 退货相关
            create_return_order: function(args) { return Object.assign(args, { id: 'ro-new', status: 'completed' }); },
            get_return_orders: function() { return { list: [], total: 0, page: 1, pageSize: 20 }; },
            get_available_batches: function() { return []; },

            // Dashboard 相关
            get_dashboard_stats: function() {
                return { todaySales: 1000, todayOrders: 5, monthSales: 30000, monthOrders: 150, lowStockCount: 2, expiringCount: 1 };
            }
        };

        // ===== 覆盖 Tauri 内部的 invoke 函数 =====
        window.__TAURI_INTERNALS__ = {
            invoke: function(command, args) {
                // 优先使用测试中覆盖的返回值
                if (OVERRIDES[command] !== undefined) {
                    return Promise.resolve(OVERRIDES[command]);
                }

                // 查找预设的 mock 路由
                var handler = ROUTES[command];
                if (handler) {
                    try {
                        return Promise.resolve(handler(args || {}));
                    } catch (e) {
                        return Promise.reject(e);
                    }
                }

                // 未匹配的命令返回 null（避免前端崩溃）
                console.warn('[mock-tauri] 未匹配的命令: ' + command);
                return Promise.resolve(null);
            },
            transformCallback: function(_callback, _once) {
                return Math.floor(Math.random() * 1000000);
            },
            convertFileSrc: function(path) { return path; },
            metadata: {
                currentWindow: { label: 'main' },
                currentWebview: { label: 'main', windowLabel: 'main' }
            }
        };
    `

    await page.addInitScript(script)
}
