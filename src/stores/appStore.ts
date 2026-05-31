/** @file 应用全局状态 - 侧边栏折叠、主题模式、主题设置 */
import { create } from 'zustand'

type ThemeMode = 'light' | 'dark'
type PrimaryColor = '#1677FF' | '#52C41A' | '#722ED1' | '#FA8C16' | '#F5222D'
type FontSize = 'small' | 'standard' | 'large'
type SidebarWidth = 180 | 220 | 260
type NavMode = 'single' | 'all'
type SidebarStyle = 'dark' | 'light'
type CompactMode = 'comfortable' | 'compact'
type BorderRadiusStyle = 'sharp' | 'rounded' | 'full'

type EyeCareLevel = 'off' | 'mild' | 'moderate' | 'strong'

interface UISettings {
  primaryColor: PrimaryColor
  fontSize: FontSize
  sidebarWidth: SidebarWidth
  navMode: NavMode
  searchShortcut: string
  sidebarStyle: SidebarStyle
  compactMode: CompactMode
  borderRadius: BorderRadiusStyle
  eyeCare: EyeCareLevel
  warmTone: boolean
}

interface AppState {
  sidebarCollapsed: boolean
  themeMode: ThemeMode
  uiSettings: UISettings
  settingsOpen: boolean
  toggleSidebar: () => void
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  setUISettings: (settings: Partial<UISettings>) => void
  resetUISettings: () => void
  setSettingsOpen: (open: boolean) => void
}

const DEFAULT_UI_SETTINGS: UISettings = {
  primaryColor: '#1677FF',
  fontSize: 'standard',
  sidebarWidth: 220,
  navMode: 'single',
  searchShortcut: 'Ctrl+K',
  sidebarStyle: 'dark',
  compactMode: 'comfortable',
  borderRadius: 'rounded',
  eyeCare: 'off',
  warmTone: false,
}

const PRIMARY_VARIANTS: Record<PrimaryColor, { hover: string; active: string; light: string; bg: string; lightDark: string; bgDark: string }> = {
  '#1677FF': { hover: '#4096FF', active: '#0958D9', light: '#E6F4FF', bg: '#F0F5FF', lightDark: '#111D2C', bgDark: '#111A2C' },
  '#52C41A': { hover: '#73D13D', active: '#389E0D', light: '#F6FFED', bg: '#FCFFE6', lightDark: '#162312', bgDark: '#1D2611' },
  '#722ED1': { hover: '#9254DE', active: '#531DAB', light: '#F9F0FF', bg: '#FDF6FF', lightDark: '#1D1028', bgDark: '#241230' },
  '#FA8C16': { hover: '#FFA940', active: '#D46B08', light: '#FFF7E6', bg: '#FFFBE6', lightDark: '#1D1A0A', bgDark: '#26200E' },
  '#F5222D': { hover: '#FF4D4F', active: '#CF1322', light: '#FFF1F0', bg: '#FFF2F0', lightDark: '#2A1215', bgDark: '#2D1618' },
}

const FONT_SIZE_MAP: Record<FontSize, string> = { small: '12px', standard: '14px', large: '16px' }

function loadTheme(): ThemeMode {
  try { return (localStorage.getItem('gl-theme') as ThemeMode) || 'light' }
  catch { return 'light' }
}

function loadUISettings(): UISettings {
  try {
    const saved = localStorage.getItem('gl-ui-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      const validColor = PRIMARY_VARIANTS[parsed.primaryColor as PrimaryColor] 
        ? parsed.primaryColor 
        : DEFAULT_UI_SETTINGS.primaryColor
      return { 
        ...DEFAULT_UI_SETTINGS, 
        ...parsed,
        primaryColor: validColor as PrimaryColor
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_UI_SETTINGS }
}

const initialTheme = loadTheme()
const initialSettings = loadUISettings()

function applyTheme(mode: ThemeMode) {
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

function applyUISettings(settings: UISettings) {
  const root = document.documentElement
  const variants = PRIMARY_VARIANTS[settings.primaryColor]

  root.style.setProperty('--gl-primary', settings.primaryColor)
  root.style.setProperty('--gl-primary-hover', variants.hover)
  root.style.setProperty('--gl-primary-active', variants.active)
  root.style.setProperty('--gl-primary-light', variants.light)
  root.style.setProperty('--gl-primary-bg', variants.bg)
  root.style.setProperty('--gl-sidebar-width', `${settings.sidebarWidth}px`)
  root.style.fontSize = FONT_SIZE_MAP[settings.fontSize]

  if (settings.sidebarStyle === 'light') {
    root.setAttribute('data-sidebar-style', 'light')
  } else {
    root.removeAttribute('data-sidebar-style')
  }

  if (settings.compactMode === 'compact') {
    root.setAttribute('data-compact', 'true')
  } else {
    root.removeAttribute('data-compact')
  }

  if (settings.borderRadius !== 'rounded') {
    root.setAttribute('data-border-radius', settings.borderRadius)
  } else {
    root.removeAttribute('data-border-radius')
  }

  if (settings.eyeCare !== 'off') {
    root.setAttribute('data-eye-care', settings.eyeCare)
  } else {
    root.removeAttribute('data-eye-care')
  }

  if (settings.warmTone) {
    root.setAttribute('data-warm-tone', 'true')
  } else {
    root.removeAttribute('data-warm-tone')
  }
}

function applyPrimaryDarkVariants(settings: UISettings) {
  const variants = PRIMARY_VARIANTS[settings.primaryColor]
  const root = document.documentElement
  root.style.setProperty('--gl-primary-light', variants.lightDark)
  root.style.setProperty('--gl-primary-bg', variants.bgDark)
}

if (typeof document !== 'undefined') {
  applyTheme(initialTheme)
  applyUISettings(initialSettings)
  if (initialTheme === 'dark') {
    applyPrimaryDarkVariants(initialSettings)
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  sidebarCollapsed: false,
  themeMode: initialTheme,
  uiSettings: initialSettings,
  settingsOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setThemeMode: (mode) => {
    localStorage.setItem('gl-theme', mode)
    applyTheme(mode)
    if (mode === 'dark') {
      applyPrimaryDarkVariants(get().uiSettings)
    } else {
      const variants = PRIMARY_VARIANTS[get().uiSettings.primaryColor]
      document.documentElement.style.setProperty('--gl-primary-light', variants.light)
      document.documentElement.style.setProperty('--gl-primary-bg', variants.bg)
    }
    set({ themeMode: mode })
  },

  toggleTheme: () => {
    const current = get().themeMode
    const next = current === 'dark' ? 'light' : 'dark'
    get().setThemeMode(next)
  },

  setUISettings: (partial) => {
    const current = get().uiSettings
    const next = { ...current, ...partial }
    localStorage.setItem('gl-ui-settings', JSON.stringify(next))
    applyUISettings(next)
    if (get().themeMode === 'dark') {
      applyPrimaryDarkVariants(next)
    }
    set({ uiSettings: next })
  },

  resetUISettings: () => {
    localStorage.removeItem('gl-ui-settings')
    applyUISettings(DEFAULT_UI_SETTINGS)
    if (get().themeMode === 'dark') {
      applyPrimaryDarkVariants(DEFAULT_UI_SETTINGS)
    }
    set({ uiSettings: { ...DEFAULT_UI_SETTINGS } })
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
}))

export type { ThemeMode, PrimaryColor, FontSize, SidebarWidth, NavMode, SidebarStyle, CompactMode, BorderRadiusStyle, EyeCareLevel, UISettings }
