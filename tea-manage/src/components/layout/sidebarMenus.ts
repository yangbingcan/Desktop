/**
 * @file 侧边栏菜单配置
 * @description v0.4.0 - 3 组分类：工作台 / 业务管理 / 系统设置
 * @change v0.5.1 - 给 MenuGroup 加 groupIcon（折叠态分组占位图标）
 * @change v0.7.0 - 图标统一切换为 UnoCSS mdi 类名（i-mdi-*），去除 @vicons 依赖
 * @design 所有菜单项直接绑定 path，无需再硬编码菜单-路由映射
 */

/** 菜单项定义 */
export interface MenuItem {
  /** 路由 path（也是标签 key） */
  key: string
  /** 显示名（标签页标题） */
  title: string
  /** 图标（UnoCSS mdi 类名，如 'i-mdi-grid'） */
  icon: string
  /** 所属分组 key */
  group: string
}

/** 菜单分组定义 */
export interface MenuGroup {
  /** 分组 key */
  key: string
  /** 分组显示名 */
  title: string
  /** 分组排序 */
  order: number
  /** 分组占位图标（折叠态显示，UnoCSS mdi 类名） */
  groupIcon: string
}

/** 全部菜单分组（按显示顺序） */
export const menuGroups: MenuGroup[] = [
  { key: 'workbench', title: '工作台', order: 1, groupIcon: 'i-mdi-apps' },
  { key: 'business', title: '业务管理', order: 2, groupIcon: 'i-mdi-briefcase-outline' },
  { key: 'system', title: '系统设置', order: 3, groupIcon: 'i-mdi-wrench' },
]

/** 全部菜单项（按显示顺序） */
export const menuItems: MenuItem[] = [
  // ========== 工作台 ==========
  { key: '/', title: '首页', icon: 'i-mdi-home-outline', group: 'workbench' },

  // ========== 业务管理 ==========
  { key: '/products', title: '商品档案', icon: 'i-mdi-grid', group: 'business' },
  { key: '/inventory', title: '库存管理', icon: 'i-mdi-cube-outline', group: 'business' },
  { key: '/purchase', title: '采购入库', icon: 'i-mdi-archive-outline', group: 'business' },
  { key: '/sales', title: '零售收银', icon: 'i-mdi-cash-register', group: 'business' },
  { key: '/members', title: '会员管理', icon: 'i-mdi-account-group-outline', group: 'business' },
  { key: '/suppliers', title: '供应商管理', icon: 'i-mdi-domain', group: 'business' },
  { key: '/returns', title: '退货出库', icon: 'i-mdi-undo-variant', group: 'business' },
  { key: '/reports/sales', title: '销售报表', icon: 'i-mdi-chart-box', group: 'business' },

  // ========== 系统设置 ==========
  { key: '/print-templates', title: '打印模板', icon: 'i-mdi-printer-outline', group: 'system' },
  { key: '/barcodes', title: '条码管理', icon: 'i-mdi-qrcode', group: 'system' },
  { key: '/settings', title: '系统设置', icon: 'i-mdi-cog-outline', group: 'system' },
]

/**
 * 根据分组获取菜单项
 */
export function getMenuItemsByGroup(groupKey: string): MenuItem[] {
  return menuItems.filter((item) => item.group === groupKey)
}
