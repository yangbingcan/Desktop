/** @file 打印模板 API 服务 */
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../stores/authStore'

const getToken = () => useAuthStore.getState().token || ''

export interface PrintTemplate {
  id: string; name: string; template_type: string
  content: string; is_default: boolean; created_at: string; updated_at: string
}

export interface TemplateInput {
  name: string; template_type: string; content: string; is_default?: boolean
}

export async function getPrintTemplates(templateType?: string) {
  return invoke<PrintTemplate[]>('get_print_templates', { token: getToken(), templateType })
}

export async function getPrintTemplate(id: string) {
  return invoke<PrintTemplate>('get_print_template', { token: getToken(), id })
}

export async function savePrintTemplate(input: TemplateInput) {
  return invoke<string>('save_print_template', { token: getToken(), input })
}

export async function deletePrintTemplate(id: string) {
  return invoke<void>('delete_print_template', { token: getToken(), id })
}

/** 模板变量占位符定义 */
export const TEMPLATE_VARIABLES = [
  { key: '{{shopName}}', label: '店铺名称' },
  { key: '{{shopAddress}}', label: '店铺地址' },
  { key: '{{shopPhone}}', label: '店铺电话' },
  { key: '{{orderNo}}', label: '单据编号' },
  { key: '{{date}}', label: '日期' },
  { key: '{{items}}', label: '商品明细' },
  { key: '{{total}}', label: '合计金额' },
  { key: '{{discount}}', label: '折扣金额' },
  { key: '{{actualAmount}}', label: '实付金额' },
  { key: '{{memberName}}', label: '会员姓名' },
  { key: '{{pointsEarned}}', label: '获得积分' },
  { key: '{{payMethod}}', label: '支付方式' },
  { key: '{{operator}}', label: '操作员' },
  { key: '{{supplierName}}', label: '供应商' },
  { key: '{{remark}}', label: '备注' },
]

/** 默认小票模板 */
export const DEFAULT_RECEIPT_TEMPLATE = `<div style="width:280px;font-family:monospace;font-size:13px;padding:8px;">
  <div style="text-align:center;">
    <h2 style="margin:0;font-size:16px;">{{shopName}}</h2>
    <p style="margin:2px 0;">{{shopAddress}}</p>
    <p style="margin:2px 0;">电话: {{shopPhone}}</p>
  </div>
  <hr style="border-top:1px dashed #000;margin:4px 0;" />
  <p style="margin:2px 0;">单号: {{orderNo}}</p>
  <p style="margin:2px 0;">日期: {{date}}</p>
  <hr style="border-top:1px dashed #000;margin:4px 0;" />
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr><th style="text-align:left;">商品</th><th style="text-align:center;">数量</th><th style="text-align:right;">金额</th></tr>
    </thead>
    <tbody>{{items}}</tbody>
    <tfoot>
      <tr><td colspan="2" style="text-align:right;">合计:</td><td style="text-align:right;">{{total}}</td></tr>
      <tr><td colspan="2" style="text-align:right;">折扣:</td><td style="text-align:right;">-{{discount}}</td></tr>
      <tr><td colspan="2" style="text-align:right;">实付:</td><td style="text-align:right;font-weight:bold;">{{actualAmount}}</td></tr>
    </tfoot>
  </table>
  <hr style="border-top:1px dashed #000;margin:4px 0;" />
  <p style="margin:2px 0;">会员: {{memberName}} (积分+{{pointsEarned}})</p>
  <p style="margin:2px 0;">支付: {{payMethod}} {{actualAmount}}</p>
  <hr style="border-top:1px dashed #000;margin:4px 0;" />
  <p style="text-align:center;margin:4px 0;">感谢惠顾，欢迎再次光临！</p>
</div>`

