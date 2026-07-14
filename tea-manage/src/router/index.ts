/**
 * @file Vue Router 路由配置
 * @description v0.4.0 - 添加 meta.tabTitle 用于标签页显示
 * @change 修复 PurchaseEdit 重复定义（v0.3.6 已知 bug）
 */
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// ========== 路由懒加载 ==========
const Dashboard = () => import('@/views/dashboard/index.vue')
const ProductList = () => import('@/views/products/ProductList.vue')
const ProductForm = () => import('@/views/products/ProductForm.vue')
const Inventory = () => import('@/views/inventory/index.vue')
const PurchaseList = () => import('@/views/purchase/PurchaseList.vue')
const PurchaseForm = () => import('@/views/purchase/PurchaseForm.vue')
const PurchaseDetail = () => import('@/views/purchase/PurchaseDetail.vue')
const Sales = () => import('@/views/sales/index.vue')
const MemberList = () => import('@/views/members/MemberList.vue')
const MemberForm = () => import('@/views/members/MemberForm.vue')
const MemberDetail = () => import('@/views/members/MemberDetail.vue')
const PrintTemplates = () => import('@/views/print-templates/index.vue')
const Barcode = () => import('@/views/barcodes/index.vue')
const Settings = () => import('@/views/settings/index.vue')
// v0.2.0 M04 出入库闭环
const SupplierList = () => import('@/views/suppliers/index.vue')
const SupplierForm = () => import('@/views/suppliers/SupplierForm.vue')
const ReturnList = () => import('@/views/returns/ReturnList.vue')
const ReturnForm = () => import('@/views/returns/ReturnForm.vue')
const ReturnDetail = () => import('@/views/returns/ReturnDetail.vue')
// v0.7.x 报表
const SalesHistory = () => import('@/views/reports/SalesHistory.vue')
// v0.5.0 登录页（公开页，不进入 AppLayout）
const Login = () => import('@/views/auth/Login.vue')

// ========== 路由配置（平铺结构，无 children 嵌套） ==========
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'Dashboard',
        component: Dashboard,
        meta: { title: '首页', tabTitle: '首页' }
    },
    {
        path: '/products',
        name: 'ProductList',
        component: ProductList,
        meta: { title: '商品列表', tabTitle: '商品档案' }
    },
    {
        path: '/products/new',
        name: 'ProductNew',
        component: ProductForm,
        meta: { title: '新增商品', tabTitle: '商品档案' }
    },
    {
        path: '/products/:id/edit',
        name: 'ProductEdit',
        component: ProductForm,
        meta: { title: '编辑商品', tabTitle: '商品档案' }
    },
    {
        path: '/inventory',
        name: 'Inventory',
        component: Inventory,
        meta: { title: '库存管理', tabTitle: '库存管理' }
    },
    {
        path: '/purchase',
        name: 'PurchaseList',
        component: PurchaseList,
        meta: { title: '入库单列表', tabTitle: '采购入库' }
    },
    {
        path: '/purchase/new',
        name: 'PurchaseNew',
        component: PurchaseForm,
        meta: { title: '新增入库单', tabTitle: '采购入库' }
    },
    {
        path: '/purchase/:id',
        name: 'PurchaseDetail',
        component: PurchaseDetail,
        meta: { title: '采购单详情', tabTitle: '采购入库' }
    },
    {
        path: '/purchase/:id/edit',
        name: 'PurchaseEdit',
        component: PurchaseForm,
        meta: { title: '编辑入库单', tabTitle: '采购入库' }
    },
    {
        path: '/sales',
        name: 'Sales',
        component: Sales,
        meta: { title: '零售收银', tabTitle: '零售收银' }
    },
    {
        path: '/members',
        name: 'MemberList',
        component: MemberList,
        meta: { title: '会员列表', tabTitle: '会员管理' }
    },
    {
        path: '/members/new',
        name: 'MemberNew',
        component: MemberForm,
        meta: { title: '新增会员', tabTitle: '会员管理' }
    },
    {
        path: '/members/:id',
        name: 'MemberDetail',
        component: MemberDetail,
        meta: { title: '会员详情', tabTitle: '会员管理' }
    },
    {
        path: '/members/:id/edit',
        name: 'MemberEdit',
        component: MemberForm,
        meta: { title: '编辑会员', tabTitle: '会员管理' }
    },
    // ========== v0.2.0 M04 出入库闭环 ==========
    {
        path: '/suppliers',
        name: 'SupplierList',
        component: SupplierList,
        meta: { title: '供应商管理', tabTitle: '供应商管理' }
    },
    {
        path: '/suppliers/new',
        name: 'SupplierNew',
        component: SupplierForm,
        meta: { title: '新增供应商', tabTitle: '供应商管理' }
    },
    {
        path: '/suppliers/:id/edit',
        name: 'SupplierEdit',
        component: SupplierForm,
        meta: { title: '编辑供应商', tabTitle: '供应商管理' }
    },
    {
        path: '/returns',
        name: 'ReturnList',
        component: ReturnList,
        meta: { title: '退货出库', tabTitle: '退货出库' }
    },
    {
        path: '/returns/new',
        name: 'ReturnNew',
        component: ReturnForm,
        meta: { title: '新增退货单', tabTitle: '退货出库' }
    },
    {
        path: '/returns/:id',
        name: 'ReturnDetail',
        component: ReturnDetail,
        meta: { title: '退货单详情', tabTitle: '退货出库' }
    },
    {
        path: '/returns/:id/edit',
        name: 'ReturnEdit',
        component: ReturnForm,
        meta: { title: '编辑退货单', tabTitle: '退货出库' }
    },
    {
        path: '/reports/sales',
        name: 'SalesHistory',
        component: SalesHistory,
        meta: { title: '销售历史', tabTitle: '报表中心' }
    },
    {
        path: '/print-templates',
        name: 'PrintTemplates',
        component: PrintTemplates,
        meta: { title: '打印模板', tabTitle: '打印模板' }
    },
    {
        path: '/barcodes',
        name: 'Barcodes',
        component: Barcode,
        meta: { title: '条码管理', tabTitle: '条码管理' }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: Settings,
        meta: { title: '系统设置', tabTitle: '系统设置' }
    },
    // ========== v0.5.0 登录页（公开） ==========
    {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: { title: '登录', tabTitle: '登录', public: true }
    }
]

// ========== 创建路由实例 ==========
const router = createRouter({
    history: createWebHistory(),
    routes
})

// ========== 导航守卫 ==========
router.beforeEach((to, _from, next) => {
    // 设置页面标题
    document.title = `${to.meta.title || '茶易管'} - 茶易管`
    // 轻量会话门禁：未登录访问非公开路由 → 重定向到登录页
    const isPublic = to.meta?.public === true
    const loggedIn = localStorage.getItem('tea-logged-in') === '1'
    if (!loggedIn && !isPublic) {
        next('/login')
    } else if (loggedIn && to.name === 'Login') {
        // 已登录再访问登录页 → 回首页
        next('/')
    } else {
        next()
    }
})

export default router
