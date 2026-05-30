/** @file 主题切换Hook - 深色/浅色模式切换与持久化 */
import { useAppStore } from '../stores/appStore'

export function useTheme() {
  const { themeMode, setThemeMode, toggleTheme } = useAppStore()

  const isDark = themeMode === 'dark'

  return {
    themeMode,
    isDark,
    setThemeMode,
    toggleTheme,
  }
}
