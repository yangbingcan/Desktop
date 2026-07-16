/** @file 茶易管V2 应用入口 - 授权门禁 + 用户权限管理 + 茶叶店业务模块 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, Spin, theme as antTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '../stores/appStore'
import { useLicenseStore } from '../stores/licenseStore'
import AppLayout from '../components/layout/AppLayout'
import GlobalLoading from '../components/common/GlobalLoading'
import ErrorBoundary from '../components/common/ErrorBoundary'
// 认证页面
import LoginPage from '../pages/auth/login'
import ActivationPage from '../pages/auth/activation'
// 系统管理页面
import DashboardPage from '../pages/dashboard'
import PermissionRolesPage from '../pages/permission/roles'
import UserListPage from '../pages/user/list'
import SystemLogsPage from '../pages/system/logs'
import SettingsGeneralPage from '../pages/settings/general'
import NotFoundPage from '../pages/NotFound'
// 茶叶店业务页面
import ProductListPage from '../pages/products/list'
import InventoryPage from '../pages/inventory'
import SalesPage from '../pages/sales'
import MemberListPage from '../pages/members/list'
import PurchaseListPage from '../pages/purchase/list'
import ReturnListPage from '../pages/returns/list'
import SupplierListPage from '../pages/suppliers/list'
import BarcodePage from '../pages/barcodes'
import PrintTemplatePage from '../pages/print-templates'
import ReportPage from '../pages/reports'
import '../styles/ant-overrides.css'
import RequireAuth from '../components/auth/RequireAuth'

/** 授权门禁：未激活时仅显示激活页，已激活才进入正常路由 */
function LicenseGuard({ children }: { children: React.ReactNode }) {
  const { activated, loading, checkStatus } = useLicenseStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    checkStatus().finally(() => setChecked(true))
  }, [checkStatus])

  if (!checked || loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--gl-content-bg)' }}>
        <Spin size="large" tip="正在检查授权状态..." />
      </div>
    )
  }

  if (!activated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/activation" element={<ActivationPage />} />
          <Route path="*" element={<Navigate to="/activation" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  const { themeMode, uiSettings } = useAppStore()
  const isDark = themeMode === 'dark'
  const isCompact = uiSettings.compactMode === 'compact'

  const themeConfig = {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: uiSettings.primaryColor,
      borderRadius: uiSettings.borderRadius === 'sharp' ? 4 : uiSettings.borderRadius === 'full' ? 14 : 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif",
      fontSize: isCompact ? 12 : 14,
      controlHeight: isCompact ? 28 : 32,
      colorBgContainer: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.72)',
      colorBgElevated: isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.85)',
      colorBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      colorBorderSecondary: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    },
    components: {
      Layout: {
        bodyBg: 'var(--gl-content-bg)',
        headerBg: isDark ? 'rgba(20, 20, 20, 0.78)' : 'rgba(255, 255, 255, 0.78)',
        siderBg: 'transparent',
      },
      Menu: {
        darkItemBg: 'transparent',
      },
    },
  }

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntApp>
        <GlobalLoading />
        <LicenseGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/activation" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                {/* 首页 */}
                <Route path="/dashboard" element={<DashboardPage />} />
                {/* 茶叶店业务 */}
                <Route path="/products" element={<ProductListPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/members" element={<MemberListPage />} />
                <Route path="/purchase" element={<PurchaseListPage />} />
                <Route path="/returns" element={<ReturnListPage />} />
                <Route path="/suppliers" element={<SupplierListPage />} />
                <Route path="/barcodes" element={<BarcodePage />} />
                <Route path="/print-templates" element={<PrintTemplatePage />} />
                <Route path="/reports" element={<ReportPage />} />
                {/* 系统管理 */}
                <Route path="/permission/roles" element={<PermissionRolesPage />} />
                <Route path="/user/list" element={<UserListPage />} />
                <Route path="/system/logs" element={<SystemLogsPage />} />
                <Route path="/settings" element={<SettingsGeneralPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </LicenseGuard>
      </AntApp>
    </ConfigProvider>
  )
}

export default function App() {
  return <ErrorBoundary><AppRoutes /></ErrorBoundary>
}
