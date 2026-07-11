---
name: version-release
description: 版本发布与安装包构建。在用户确认发布版本时调用，执行编译检查、版本号同步、安装包构建、版本文档更新全流程。
agent_created: true
---
# 版本发布流程

在用户明确确认发布版本后执行。必须等待用户说出"发版"、"发布"、"可以发版"等确认性语言。

## 发布前检查清单

### 1. 编译验证
```bash
# TypeScript 编译检查
npx tsc --noEmit

# Rust 编译检查
cargo check
```
两项必须全部通过，否则终止发布流程。

### 2. 版本号同步（4个文件）
| 文件 | 字段 | 示例 |
|------|------|------|
| `A1JXC/package.json` | `version` | `"1.4.6"` |
| `A1JXC/src-tauri/Cargo.toml` | `version` | `version = "1.4.6"` |
| `A1JXC/src-tauri/tauri.conf.json` | `version` | `"1.4.6"` |
| `A1JXC/src/config/version.ts` | `APP_VERSION` | `"1.4.6"` |

### 3. 更新日志同步
- 在 `A1JXC/src/data/changelog.json` 头部添加新版本条目
- JSON中不能使用中文引号，用「」替代""
- 版本号、日期、变更内容必须与版本文档一致

### 4. 版本文档更新
- 在 `specs/releases/v{版本号}.md` 记录实际发布时间（精确到分钟）
- 格式：`2026-05-20 22:51`

## 安装包定制化配置

### tauri.conf.json 关键配置项
```json
{
  "productName": "管用GL",
  "identifier": "com.gl.desktop",
  "bundle": {
    "targets": ["nsis"],
    "windows": {
      "allowDowngrades": true,
      "nsis": {
        "languages": ["SimpChinese"],
        "displayLanguageSelector": false,
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/installer-header.bmp",
        "sidebarImage": "icons/installer-sidebar.bmp",
        "installMode": "both",
        "installerHooks": "icons/nsis-hooks.nsh"
      },
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      }
    }
  }
}
```

### 定制化说明

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| productName | 管用GL | 安装包文件名、桌面快捷方式名称、窗口标题 |
| languages | SimpChinese | 仅简体中文安装界面 |
| displayLanguageSelector | false | 不显示语言选择器 |
| installMode | both | 用户选择当前用户或所有用户 |
| allowDowngrades | true | 允许降级安装（覆盖旧版本不提示卸载） |
| webviewInstallMode | embedBootstrapper | 内嵌WebView2引导程序（+1.8MB） |
| headerImage | installer-header.bmp | 安装器顶部图片（150x57 BMP） |
| sidebarImage | installer-sidebar.bmp | 安装器侧边栏图片（164x314 BMP） |
| installerHooks | nsis-hooks.nsh | NSIS自定义钩子脚本 |

### 图标文件清单
| 文件 | 用途 |
|------|------|
| `icons/icon.png` | 源图标（1024x1024 PNG） |
| `icons/icon.ico` | Windows应用图标 |
| `icons/32x32.png` | 小尺寸图标 |
| `icons/128x128.png` | 中尺寸图标 |
| `icons/128x128@2x.png` | 高清中尺寸图标 |
| `icons/icon.icns` | macOS图标 |
| `icons/installer-header.bmp` | NSIS安装器顶部品牌图 |
| `icons/installer-sidebar.bmp` | NSIS安装器侧边栏品牌图 |

### 更换Logo流程
1. 将新logo PNG文件复制为 `src-tauri/icons/icon.png`
2. 运行 `npx tauri icon src-tauri/icons/icon.png` 重新生成所有尺寸
3. 用Python重新生成安装器品牌图片：
```python
from PIL import Image, ImageDraw, ImageFont
# Header: 150x57 品牌色背景+logo+产品名
# Sidebar: 164x314 品牌色背景+logo+产品名+slogan
```

## 构建命令

```bash
# 必须清除CI环境变量（tauri CLI的--ci参数不兼容"1"值）
$env:CI=""; npx tauri build
```

### 构建产物
- 安装包：`src-tauri/target/release/bundle/nsis/管用GL_{版本}_x64-setup.exe`
- 可执行文件：`src-tauri/target/release/gl.exe`

## 发布后验证

构建完成后确认以下内容：
1. 安装包文件名格式正确：`管用GL_{版本}_x64-setup.exe`
2. 版本文档已记录实际发布时间
3. changelog.json 已添加新版本条目

## 注意事项

- **禁止自动发版** - 必须等待用户明确确认
- **CI环境变量** - PowerShell中必须 `$env:CI=""` 再构建，否则tauri CLI报错
- **图标一致性** - 更换logo后必须同时更新icon.png和安装器品牌图片
- **NSIS hooks** - 空宏不能包含任何NSIS指令，注释用`;`不用`//`
