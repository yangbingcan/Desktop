/**
 * @file 入口文件
 * @description v0.4.0 - 引入主题 CSS 变量 + 全局样式 + 注册 Naive UI 组件
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'
// 必须在最早期引入主题 CSS（变量在 :root 上定义，越早越好，避免主题闪烁）
import './styles/variables.css'
import './styles/globals.css'
// v0.5.0 Naive UI 组件美化覆盖（必须晚于 variables/globals，确保变量已生效）
import './styles/n-overrides.css'
// 静态导入 theme store 以触发其 applyToDOM 副作用（防止主题闪烁）
import { useThemeStore } from './stores/theme'
// 静态导入 tabs store 以触发其从 localStorage 恢复（让首次渲染时标签已就绪）
import { useTabsStore } from './stores/tabs'
import 'virtual:uno.css'
// v0.7.1 全局错误守卫：任何运行时异常以可见面板呈现，避免整页白屏无提示
import { installErrorGuard, vueErrorHandler } from './utils/errorGuard'

import {
    create,
    NButton,
    NButtonGroup,
    NCard,
    NInput,
    NForm,
    NFormItem,
    NGrid,
    NGi,
    NSelect,
    NTable,
    NTabs,
    NTabPane,
    NTag,
    NText,
    NStatistic,
    NModal,
    NDatePicker,
    NInputNumber,
    NList,
    NListItem,
    NSwitch,
    NSpace,
    NDivider,
    NCheckbox,
    NCheckboxGroup,
    NRadio,
    NRadioGroup,
    NRadioButton,
    NEmpty,
    NDescriptions,
    NDescriptionsItem,
    NDataTable,
    NMessageProvider,
    NDialogProvider,
    NPopconfirm,
    NPagination,
    NAlert,
    NSpin,
    NConfigProvider,
    NIcon,
    NDrawer,
    NDrawerContent,
    NTooltip,
    NDropdown,
    NCollapse,
    NCollapseItem,
} from 'naive-ui'

// 创建 Naive UI 实例
const naive = create({
    components: [
        NButton,
        NButtonGroup,
        NCard,
        NInput,
        NForm,
        NFormItem,
        NGrid,
        NGi,
        NSelect,
        NTable,
        NTabs,
        NTabPane,
        NTag,
        NText,
        NStatistic,
        NModal,
        NDatePicker,
        NInputNumber,
        NList,
        NListItem,
        NSwitch,
        NSpace,
        NDivider,
        NCheckbox,
        NCheckboxGroup,
        NRadio,
        NRadioGroup,
        NRadioButton,
        NEmpty,
        NDescriptions,
        NDescriptionsItem,
        NDataTable,
        NMessageProvider,
    NDialogProvider,
        NPopconfirm,
        NPagination,
        NAlert,
        NSpin,
        NConfigProvider,
        NIcon,
        NDrawer,
        NDrawerContent,
        NTooltip,
        NDropdown,
        NCollapse,
        NCollapseItem,
    ]
})

// 创建并挂载应用
const app = createApp(App)

// v0.7.1 安装全局错误守卫，并在 Vue 错误通道挂接处理函数
installErrorGuard()
app.config.errorHandler = vueErrorHandler

app.use(pinia)
// 主动初始化 store（触发初始化副作用：主题应用到 DOM、标签从 localStorage 恢复）
useThemeStore(pinia)
useTabsStore(pinia)

app.use(router)
app.use(naive)

app.mount('#app')
