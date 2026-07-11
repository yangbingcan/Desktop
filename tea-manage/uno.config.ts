/**
 * @file UnoCSS 配置文件
 * @description 原子化 CSS 配置 - 深茶绿主题 + MDI 图标集（茶叶店调性）
 * @change 商品档案重构：接入 @iconify-json/mdi 让 i-mdi-leaf / i-mdi-tea / i-mdi-magnify 等可用；
 *        新增 p-md 快捷（页面根节点统一内边距）；移除会覆盖全局 .tea-page 的暖色快捷，避免与 variables.css 冲突。
 */
import { defineConfig, presetUno, presetIcons } from 'unocss'
import { icons as mdi } from '@iconify-json/mdi'

export default defineConfig({
    presets: [
        presetUno(),
        presetIcons({
            scale: 1.2,
            // MDI 图标集：茶叶店专属图标（i-mdi-leaf / i-mdi-tea / i-mdi-magnify 等）由此提供
            collections: { mdi },
            warn: false
        })
    ],
    // 自定义快捷方式（仅做布局/间距聚合，不覆盖 Naive UI 核心结构）
    shortcuts: {
        'flex-center': 'flex items-center justify-center',
        'flex-between': 'flex items-center justify-between',
        // 页面根节点统一内边距，防止内容贴边（配合全局 .tea-page 使用）
        'p-md': 'px-4 py-3',
        // 备用卡片快捷（非必用，保留兼容）
        'tea-card': 'bg-white rounded border border-[#E8E0D6] shadow-sm',
    },
    // 茶色系主题（语义色仍保留，组件主色由 variables.css 的 --tea-primary 驱动）
    theme: {
        colors: {
            // 主色调（深茶绿，与 Naive UI themeOverrides 保持一致）
            'tea-primary': '#4A6741',
            'tea-primary-hover': '#5C7A50',
            'tea-primary-active': '#3C5532',
            // 中性背景
            'tea-bg': '#F5F7FA',
            'tea-surface': '#FFFFFF',
            'tea-border': '#E8E0D6',
            'tea-border-light': '#F0E8DC',
            'tea-text': '#3D4A38',
            'tea-text-light': '#6B7B66',
            'tea-text-muted': '#9AA89A',
            // 功能色
            'tea-success': '#67C23A',
            'tea-warning': '#E6A23C',
            'tea-error': '#F56C6C',
            'tea-info': '#1677FF',
        }
    }
})
