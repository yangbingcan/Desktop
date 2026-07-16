/** @file 销售收银 API 服务 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const getToken = () => useAuthStore.getState().token || ''

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

export interface SaleItemInput {
  product_id: string
  unit_id: string
  quantity: number
}

export interface SaleOrderInput {
  items: SaleItemInput[]
  member_id?: string
  apply_member_discount?: boolean
  points_deduct?: number
  pay_method?: string
  remark?: string
}

export async function createSaleOrder(input: SaleOrderInput) {
  return invoke<any>('create_sale_order', { token: getToken(), input })
}

export async function getSaleOrders(params: { page?: number; pageSize?: number; startDate?: string; endDate?: string; memberId?: string }) {
  return invoke<any>('get_sale_orders', { token: getToken(), ...params })
}

export async function getSaleOrder(id: string) {
  return invoke<any>('get_sale_order', { token: getToken(), id })
}

export async function getDashboardStats() {
  return invoke<any>('get_dashboard_stats', { token: getToken() })
}

export async function getMemberByPhone(phone: string) {
  return invoke<any>('get_member_by_phone', { token: getToken(), phone })
}

