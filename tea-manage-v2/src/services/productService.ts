/** @file 商品档案 API 服务 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

export interface Product {
  id: string; code: string; name: string; category_id: string | null
  category_name: string | null; product_type: string; base_unit: string
  origin: string | null; year: string | null; grade: string | null
  fermentation_level: string | null; roast_level: string | null
  image_url: string | null; default_unit_id: string | null
  is_active: boolean; stock_grams: number; stock_units: number
  created_at: string; updated_at: string
}

export interface SalesUnit {
  id: string; product_id: string; name: string; conversion_to_base: number
  retail_price: number; member_price: number; sort_order: number
}

export interface UnitInput {
  id?: string; name: string; conversion_to_base: number
  retail_price: number; member_price: number
}

export interface CreateProductInput {
  name: string; code?: string; category_id?: string | null
  product_type: string; base_unit: string
  origin?: string; year?: string; grade?: string
  fermentation_level?: string; roast_level?: string
  image_url?: string; units: UnitInput[]
}

export interface UpdateProductInput {
  name?: string; code?: string; category_id?: string | null
  product_type?: string; base_unit?: string
  origin?: string; year?: string; grade?: string
  fermentation_level?: string; roast_level?: string
  image_url?: string; is_active?: boolean
  units?: UnitInput[]
}

export interface Category {
  id: string; name: string; parent_id: string | null
  level: number; sort_order: number
}

const getToken = () => useAuthStore.getState().token || ''

export async function getProducts(params: { page?: number; pageSize?: number; keyword?: string; categoryId?: string }) {
  return invoke<any>('get_products', { token: getToken(), ...params })
}

export async function getProduct(id: string) {
  return invoke<any>('get_product', { token: getToken(), id })
}

export async function createProduct(input: CreateProductInput) {
  return invoke<string>('create_product', { token: getToken(), input })
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  return invoke<void>('update_product', { token: getToken(), id, input })
}

export async function deleteProduct(id: string) {
  return invoke<void>('delete_product', { token: getToken(), id })
}

export async function getCategories() {
  return invoke<Category[]>('get_categories', { token: getToken() })
}

export async function createCategory(input: { name: string; parent_id?: string; level: number; sort_order?: number }) {
  return invoke<string>('create_category', { token: getToken(), input })
}

