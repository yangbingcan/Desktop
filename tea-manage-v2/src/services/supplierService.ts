/** @file 供应商管理 API 服务 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const getToken = () => useAuthStore.getState().token || ''

export interface Supplier {
  id: string; name: string; contact_person: string | null
  contact_phone: string | null; address: string | null
  main_categories: string; remark: string; is_active: boolean
  created_at: string; updated_at: string
}

export interface SupplierInput {
  name: string; contact_person?: string; contact_phone?: string
  address?: string; main_categories: string; remark?: string
}

export async function getSuppliers(params: { page?: number; pageSize?: number; keyword?: string }) {
  return invoke<any>('get_suppliers', { token: getToken(), ...params })
}

export async function getAllActiveSuppliers() {
  return invoke<any>('get_all_active_suppliers', { token: getToken() })
}

export async function getSupplier(id: string) {
  return invoke<Supplier>('get_supplier', { token: getToken(), id })
}

export async function createSupplier(input: SupplierInput) {
  return invoke<string>('create_supplier', { token: getToken(), input })
}

export async function updateSupplier(id: string, input: SupplierInput) {
  return invoke<void>('update_supplier', { token: getToken(), id, input })
}

export async function deleteSupplier(id: string) {
  return invoke<void>('delete_supplier', { token: getToken(), id })
}

