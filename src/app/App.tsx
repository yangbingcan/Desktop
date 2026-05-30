/** @file 应用入口 v8.0 - 企业级精致主题，毛玻璃质感配色 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '../stores/appStore'
import AppLayout from '../components/layout/AppLayout'
import GlobalLoading from '../components/common/GlobalLoading'
import LoginPage from '../pages/auth/login'
import DashboardPage from '../pages/dashboard'
import FormDesignerPage from '../pages/form-designer'
import DataCenterListPage from '../pages/data-center/list'
import WorkflowPendingPage from '../pages/workflow/pending'
import PermissionRolesPage from '../pages/permission/roles'
import UserListPage from '../pages/user/list'
import SettingsGeneralPage from '../pages/settings/general'
import '../styles/ant-overrides.css'
import RequireAuth from '../components/auth/RequireAuth'

function AppRoutes() {
  const { themeMode, uiSettings } = useAppStore()
  const isDark = themeMode === 'dark'
  const isCompact = uiSettings.compactMode === 'compact'

  const themeConfig = {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: uiSettings.primaryColor,
      borderRadius: uiSettings.borderRadius === 'sharp' ? 4 : uiSettings.borderRadius === 'full' ? 14 : 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/form-designer" element={<FormDesignerPage />} />
              <Route path="/data-center" element={<DataCenterListPage />} />
              <Route path="/workflow/pending" element={<WorkflowPendingPage />} />
              <Route path="/permission/roles" element={<PermissionRolesPage />} />
              <Route path="/user/list" element={<UserListPage />} />
              <Route path="/settings" element={<SettingsGeneralPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default function App() {
  return <AppRoutes />
}
