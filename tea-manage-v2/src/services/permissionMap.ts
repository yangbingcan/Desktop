/** @file 权限映射 - 路由与权限模块的对应关系（模块:操作格式，路由只匹配模块部分） */
export const routePermissionMap: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/products': 'product',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/members': 'member',
  '/purchase': 'purchase',
  '/returns': 'return',
  '/suppliers': 'supplier',
  '/reports': 'report',
  '/barcodes': 'barcode',
  '/print-templates': 'print',
  '/permission': 'permission',
  '/user': 'user_manage',
  '/system': 'system_log',
  '/settings': 'settings',
}

/** 15种操作类型定义 */
export const PERMISSION_ACTIONS = [
  { key: 'view', label: '查看' },
  { key: 'add', label: '新增' },
  { key: 'edit', label: '修改' },
  { key: 'delete', label: '删除' },
  { key: 'audit', label: '审核' },
  { key: 'unaudit', label: '消审' },
  { key: 'void', label: '冲单' },
  { key: 'edit_date', label: '修改业务日期' },
  { key: 'edit_other', label: '修改其他信息' },
  { key: 'preview', label: '预览' },
  { key: 'print', label: '打印' },
  { key: 'design_report', label: '设计报表' },
  { key: 'import', label: '导入' },
  { key: 'export', label: '导出' },
  { key: 'terminate', label: '终止' },
] as const

export type PermissionAction = typeof PERMISSION_ACTIONS[number]['key']
