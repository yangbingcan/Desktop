/** @file 主题设置面板 - 外观/排版/布局/辅助配置，右侧抽屉 */
import { Drawer, Segmented, Switch, Input, Button, Divider } from 'antd'
import { useAppStore } from '../../stores/appStore'
import type { PrimaryColor, FontSize, SidebarWidth, NavMode, SidebarStyle, CompactMode, BorderRadiusStyle } from '../../stores/appStore'

const COLOR_OPTIONS: { value: PrimaryColor; label: string; hex: string }[] = [
  { value: '#1677FF', label: '拂晓蓝', hex: '#1677FF' },
  { value: '#52C41A', label: '极光绿', hex: '#52C41A' },
  { value: '#722ED1', label: '酱紫', hex: '#722ED1' },
  { value: '#FA8C16', label: '日耀橙', hex: '#FA8C16' },
  { value: '#F5222D', label: '中国红', hex: '#F5222D' },
]

export default function ThemeSettings() {
  const { settingsOpen, setSettingsOpen, uiSettings, setUISettings, resetUISettings, themeMode, setThemeMode } = useAppStore()

  return (
    <Drawer
      title="主题设置"
      placement="right"
      width={340}
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <SectionTitle>外观</SectionTitle>

      <SettingRow label="主题模式">
        <Segmented
          value={themeMode}
          onChange={(v) => setThemeMode(v as 'light' | 'dark')}
          size="small"
          options={[
            { label: '浅色', value: 'light' },
            { label: '深色', value: 'dark' },
          ]}
        />
      </SettingRow>

      {themeMode === 'light' && (
        <SettingRow label="侧边栏风格">
          <Segmented
            value={uiSettings.sidebarStyle}
            onChange={(v) => setUISettings({ sidebarStyle: v as SidebarStyle })}
            size="small"
            options={[
              { label: '深色', value: 'dark' },
              { label: '浅色', value: 'light' },
            ]}
          />
        </SettingRow>
      )}

      <div className="mb-5">
        <div className="text-[12px] mb-2" style={{ color: 'var(--gl-text-tertiary)' }}>主色调</div>
        <div className="flex gap-3 flex-wrap">
          {COLOR_OPTIONS.map((c) => (
            <div
              key={c.value}
              onClick={() => setUISettings({ primaryColor: c.value })}
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              <div
                className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                style={{
                  background: c.hex,
                  borderColor: uiSettings.primaryColor === c.value ? 'var(--gl-text-primary)' : 'transparent',
                  boxShadow: uiSettings.primaryColor === c.value ? `0 0 0 2px ${c.hex}40` : 'none',
                }}
              >
                {uiSettings.primaryColor === c.value && (
                  <span className="text-white text-[10px] font-bold">&#10003;</span>
                )}
              </div>
              <span className="text-[11px]" style={{ color: 'var(--gl-text-tertiary)' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Divider style={{ margin: '8px 0 16px', borderColor: 'var(--gl-border-light)' }} />
      <SectionTitle>排版</SectionTitle>

      <SettingRow label="字号">
        <Segmented
          value={uiSettings.fontSize}
          onChange={(v) => setUISettings({ fontSize: v as FontSize })}
          size="small"
          options={[
            { label: '小', value: 'small' },
            { label: '标准', value: 'standard' },
            { label: '大', value: 'large' },
          ]}
        />
      </SettingRow>

      <SettingRow label="圆角风格">
        <Segmented
          value={uiSettings.borderRadius}
          onChange={(v) => setUISettings({ borderRadius: v as BorderRadiusStyle })}
          size="small"
          options={[
            { label: '锐利', value: 'sharp' },
            { label: '圆润', value: 'rounded' },
            { label: '饱满', value: 'full' },
          ]}
        />
      </SettingRow>

      <Divider style={{ margin: '8px 0 16px', borderColor: 'var(--gl-border-light)' }} />
      <SectionTitle>布局</SectionTitle>

      <SettingRow label="紧凑模式">
        <Segmented
          value={uiSettings.compactMode}
          onChange={(v) => setUISettings({ compactMode: v as CompactMode })}
          size="small"
          options={[
            { label: '舒适', value: 'comfortable' },
            { label: '紧凑', value: 'compact' },
          ]}
        />
      </SettingRow>

      <SettingRow label="侧边栏宽度">
        <Segmented
          value={uiSettings.sidebarWidth}
          onChange={(v) => setUISettings({ sidebarWidth: v as SidebarWidth })}
          size="small"
          options={[
            { label: '紧凑', value: 180 },
            { label: '标准', value: 220 },
            { label: '宽敞', value: 260 },
          ]}
        />
      </SettingRow>

      <SettingRow label="导航模式">
        <Segmented
          value={uiSettings.navMode}
          onChange={(v) => setUISettings({ navMode: v as NavMode })}
          size="small"
          options={[
            { label: '单展开', value: 'single' },
            { label: '全部展开', value: 'all' },
          ]}
        />
      </SettingRow>

      <Divider style={{ margin: '8px 0 16px', borderColor: 'var(--gl-border-light)' }} />
      <SectionTitle>辅助</SectionTitle>

      <SettingRow label="色弱模式">
        <Switch
          size="small"
          checked={uiSettings.colorWeak}
          onChange={(checked) => setUISettings({ colorWeak: checked })}
        />
      </SettingRow>

      <SettingRow label="搜索快捷键">
        <Input
          value={uiSettings.searchShortcut}
          onChange={(e) => setUISettings({ searchShortcut: e.target.value })}
          size="small"
          style={{ borderRadius: 'var(--gl-radius-md)', width: 120 }}
        />
      </SettingRow>

      <Divider style={{ margin: '12px 0 16px', borderColor: 'var(--gl-border-light)' }} />

      <div className="flex gap-2">
        <Button onClick={resetUISettings} size="small">恢复默认</Button>
      </div>
    </Drawer>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[13px] font-semibold mb-3"
      style={{ color: 'var(--gl-text-primary)' }}
    >
      {children}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="text-[12px]" style={{ color: 'var(--gl-text-secondary)' }}>{label}</span>
      {children}
    </div>
  )
}
