/** @file 库存管理 API 服务 */
import { invoke } from '@tauri-apps/api/core'

const getToken = () => localStorage.getItem('token') || ''

export interface InventoryItem {
  product_id: string; product_name: string; category_name: string | null
  product_type: string; stock_grams: number; stock_units: number; display_stock: string
}

export interface InventoryBatch {
  id: string; product_id: string; batch_code: string; purchase_price: number
  total_grams: number; remaining_grams: number; supplier_id: string | null
  produced_date: string | null; expire_date: string | null; created_at: string
}

export interface StockFlow {
  id: string; product_id: string; batch_id: string | null; flow_type: string
  change_grams: number; balance_grams: number; order_id: string | null
  remark: string | null; created_at: string
}

export interface PurchaseInInput {
  product_id: string; unit_id: string; quantity: number; unit_price: number
  supplier_id?: string; remark?: string
}

export interface DamageOutInput {
  product_id: string; grams: number; remark: string
}

export interface AdjustInput {
  product_id: string; grams: number; remark: string
}

export async function getInventory(params: { page?: number; pageSize?: number; keyword?: string }) {
  return invoke<any>('get_inventory', { token: getToken(), ...params })
}

export async function getInventoryDetail(productId: string) {
  return invoke<any>('get_inventory_detail', { token: getToken(), productId })
}

export async function getStockFlows(productId: string, page?: number, pageSize?: number) {
  return invoke<any>('get_stock_flows', { token: getToken(), productId, page, pageSize })
}

export async function purchaseIn(input: PurchaseInInput) {
  return invoke<any>('purchase_in', { token: getToken(), input })
}

export async function damageOut(input: DamageOutInput) {
  return invoke<void>('damage_out', { token: getToken(), input })
}

export async function adjustStock(input: AdjustInput) {
  return invoke<void>('adjust_stock', { token: getToken(), input })
}

export async function getAvailableBatches(productId: string) {
  return invoke<any>('get_available_batches', { token: getToken(), productId })
}
