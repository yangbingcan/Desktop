/** @file 应用入口 v11.0 - 授权门禁 + 用户权限管理 + 错误边界 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, Spin, theme as antTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '../stores/appStore'
import { useLicenseStore } from '../stores/licenseStore'
import AppLayout from '../components/layout/AppLayout'
import GlobalLoading from '../components/common/GlobalLoading'
import ErrorBoundary from '../components/common/ErrorBoundary'
import LoginPage from '../pages/auth/login'
import ActivationPage from '../pages/auth/activation'
import DashboardPage from '../pages/dashboard'
import PermissionRolesPage from '../pages/permission/roles'
import UserListPage from '../pages/user/list'
import SystemLogsPage from '../pages/system/logs'
import SettingsGeneralPage from '../pages/settings/general'
import NotFoundPage from '../pages/NotFound'
import '../styles/ant-overrides.css'
import RequireAuth from '../components/auth/RequireAuth'

/** 授权门禁：未激活时仅显示激活页，已激活才进入正常路由 */
function LicenseGuard({ children }: { children: React.ReactNode }) {
  const { activated, loading, checkStatus } = useLicenseStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    checkStatus().finally(() => setChecked(true))
  }, [checkStatus])

  // 初始化检查中：显示全屏 Loading
  if (!checked || loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--gl-content-bg)' }}>
        <Spin size="large" tip="正在检查授权状态..." />
      </div>
    )
  }

  // 未激活：只显示激活页路由
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

  // 已激活：正常路由
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
                <Route path="/dashboard" element={<DashboardPage />} />
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
