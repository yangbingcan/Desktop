<!--
  @file 登录页
  @description 茶易管 - 极光装饰背景 + 渐变登录卡片 + 下划线输入 + shimmer 按钮
  @refactor v0.6.0 图标体系迁移：移除 @vicons/ionicons5，全部改用 UnoCSS mdi
            （i-mdi-leaf / i-mdi-account / i-mdi-lock / i-mdi-eye / i-mdi-eye-off /
             i-mdi-theme-light-dark）；标题字体显式使用无衬线变量（移除 serif 引用）。
            配色沿用全局茶绿 CSS 变量（--tea-primary 等），保留登录 / 记住密码 /
            主题切换 / 装饰背景等全部业务逻辑。
-->
<template>
  <div class="tea-login">
    <!-- 装饰层 1：极光 -->
    <div class="tea-login-aurora" />
    <!-- 装饰层 2：网格 -->
    <div class="tea-login-grid" />
    <!-- 装饰层 3：噪点 -->
    <div class="tea-login-noise" />
    <!-- 装饰层 4：发光圆点 -->
    <div class="tea-login-dots">
      <span
        v-for="(dot, idx) in dots"
        :key="idx"
        class="tea-login-dot"
        :style="dot.style"
      />
    </div>

    <!-- 中央登录卡片 -->
    <div class="tea-login-card">
      <div class="tea-login-card-accent" />
      <!-- 主题切换按钮（卡片右上角） -->
      <button
        class="tea-login-theme-toggle"
        :title="themeMode === 'dark' ? '切换浅色' : '切换深色'"
        @click="toggleTheme"
      >
        <span class="i-mdi-theme-light-dark" style="font-size: 16px" />
      </button>
      <div class="tea-login-card-content">
        <!-- Logo -->
        <div class="tea-login-logo-wrap">
          <div class="tea-login-logo-glow" />
          <div class="tea-login-logo-ring">
            <div class="tea-login-logo">
              <span class="i-mdi-leaf" style="font-size: 32px; color: #ffffff" />
            </div>
          </div>
        </div>

        <!-- 标题 + 副标题 -->
        <h1 class="tea-login-title">茶易管</h1>
        <p class="tea-login-subtitle">茶香伴读 · 一盏一世界</p>

        <!-- 表单 -->
        <n-form class="tea-login-form" @submit.prevent="handleLogin">
          <div class="tea-login-field">
            <span class="tea-login-field-icon i-mdi-account" />
            <input
              v-model="form.username"
              class="tea-login-input"
              type="text"
              placeholder="账号"
              autocomplete="username"
            />
          </div>

          <div class="tea-login-field">
            <span class="tea-login-field-icon i-mdi-lock" />
            <input
              v-model="form.password"
              class="tea-login-input"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密码"
              autocomplete="current-password"
            />
            <span
              class="tea-login-field-toggle"
              :title="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <span :class="showPassword ? 'i-mdi-eye-off' : 'i-mdi-eye'" style="font-size: 14px" />
            </span>
          </div>

          <button
            type="submit"
            class="tea-login-btn"
            :disabled="loading"
          >
            <span class="tea-login-btn-text">{{ loading ? '登录中...' : '登 录' }}</span>
          </button>

          <!-- 记住密码 -->
          <div class="tea-login-remember">
            <label class="tea-login-remember-label">
              <input
                v-model="rememberPassword"
                type="checkbox"
                class="tea-login-remember-checkbox"
              />
              <span>记住密码</span>
            </label>
          </div>
        </n-form>

        <!-- 底部说明 -->
        <p class="tea-login-footer">
          本系统为本地单机版 · 任意账号密码即可进入演示
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Login 组件逻辑（严格保留，未改任何行为）
 * - 4 层装饰背景（极光 + 网格 + 噪点 + 圆点）
 * - 渐变登录卡片 + 顶部光带 + Logo 脉冲 + 标题渐变
 * - 下划线输入框 + 密码切换 + shimmer 按钮
 * - 任意账号密码跳转 /（UI 壳占位）
 * - 记住密码（localStorage）+ 主题切换
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const themeStore = useThemeStore()

/** 主题模式 + 切换 */
const themeMode = computed(() => themeStore.themeMode)
const toggleTheme = () => themeStore.toggleTheme()

/** 表单状态 */
const form = ref({ username: '', password: '' })
const showPassword = ref(false)
const loading = ref(false)
/** 记住密码勾选 */
const rememberPassword = ref(false)

// ========== localStorage 工具 ==========

/** localStorage 键 */
const STORAGE_KEY_USERNAME = 'tea-last-username'
const STORAGE_KEY_REMEMBER = 'tea-remember'
const STORAGE_KEY_PASSWORD = 'tea-last-password'

/**
 * base64 编码（仅本地防明文，非加密）
 */
function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return ''
  }
}

function decodeBase64(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str)))
  } catch {
    return ''
  }
}

/**
 * 加载记住的登录信息
 */
function loadRememberedLogin(): { username: string; password: string; remember: boolean } {
  try {
    const remember = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true'
    const username = localStorage.getItem(STORAGE_KEY_USERNAME) || ''
    const password = remember
      ? decodeBase64(localStorage.getItem(STORAGE_KEY_PASSWORD) || '')
      : ''
    return { username, password, remember }
  } catch {
    return { username: '', password: '', remember: false }
  }
}

/**
 * 保存登录信息
 * @param remember 勾选则保存密码；不勾选则清空密码但保留用户名
 */
function saveRememberedLogin(username: string, password: string, remember: boolean) {
  try {
    if (remember && username) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true')
      localStorage.setItem(STORAGE_KEY_USERNAME, username)
      localStorage.setItem(STORAGE_KEY_PASSWORD, encodeBase64(password))
    } else {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'false')
      localStorage.setItem(STORAGE_KEY_USERNAME, username)
      localStorage.removeItem(STORAGE_KEY_PASSWORD)
    }
  } catch {
    /* 忽略（quota / private mode） */
  }
}

/**
 * 装饰圆点 - 15 个随机位置 + 错落动画
 * 注：在 setup 中生成一次（避免 SSR/水合不一致）
 */
const dots = computed(() => {
  const arr: { style: Record<string, string> }[] = []
  for (let i = 0; i < 15; i++) {
    arr.push({
      style: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        animationDuration: `${2.5 + Math.random() * 2}s`,
      },
    })
  }
  return arr
})

/** 登录处理（UI 壳：任意账号密码直接跳转） */
async function handleLogin() {
  if (loading.value) return
  loading.value = true
  // 保存登录信息到 localStorage
  saveRememberedLogin(form.value.username, form.value.password, rememberPassword.value)
  // 写入登录态标记（轻量会话门禁依赖此标记）
  localStorage.setItem('tea-logged-in', '1')
  // 模拟一点点延迟，让按钮 shimmer 走完
  setTimeout(() => {
    loading.value = false
    router.push('/')
  }, 400)
}

onMounted(() => {
  // 从 localStorage 恢复登录信息
  const saved = loadRememberedLogin()
  if (saved.username) {
    form.value.username = saved.username
    if (saved.remember && saved.password) {
      form.value.password = saved.password
      rememberPassword.value = true
    }
  } else {
    // 首次进入填充演示账号
    form.value.username = 'demo'
    form.value.password = 'demo'
  }
})
</script>

<style scoped>
/* ==================== 容器 ==================== */
.tea-login {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--tea-login-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

/* ==================== 装饰层 1：极光 ==================== */
.tea-login-aurora {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 130% 90% at 10% 15%, var(--tea-login-aurora-1) 0%, transparent 65%),
    radial-gradient(ellipse 90% 130% at 90% 85%, var(--tea-login-aurora-2) 0%, transparent 60%);
  animation: teaAuroraDrift 30s ease-in-out infinite alternate;
  z-index: 0;
}

@keyframes teaAuroraDrift {
  0% { transform: translate(0, 0); }
  50% { transform: translate(2%, -1.5%); }
  100% { transform: translate(-1%, 1%); }
}

/* ==================== 装饰层 2：网格 ==================== */
.tea-login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--tea-login-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--tea-login-grid-line) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 65% at 50% 50%, black 15%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 70% 65% at 50% 50%, black 15%, transparent 75%);
  z-index: 1;
}

/* ==================== 装饰层 3：噪点 ==================== */
.tea-login-noise {
  position: absolute;
  inset: 0;
  opacity: 0.25;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>");
  background-repeat: repeat;
  background-size: 160px 160px;
  z-index: 2;
  pointer-events: none;
}

/* ==================== 装饰层 4：发光圆点 ==================== */
.tea-login-dots {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.tea-login-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tea-login-dot-color);
  box-shadow: 0 0 8px 1px var(--tea-login-dot-glow);
  animation: teaDotPulse 3s ease-in-out infinite;
}

@keyframes teaDotPulse {
  0%, 100% { opacity: 0.25; transform: scale(0.7); }
  50% { opacity: 1; transform: scale(1.6); }
}

/* ==================== 卡片 ==================== */
.tea-login-card {
  position: relative;
  width: 400px;
  max-width: 90vw;
  padding: 36px 32px 28px;
  background: var(--tea-card-bg);
  backdrop-filter: var(--tea-card-blur);
  -webkit-backdrop-filter: var(--tea-card-blur);
  border: 1px solid var(--tea-card-border);
  border-top: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--tea-radius-xl);
  box-shadow: var(--tea-login-card-shadow);
  z-index: 10;
  animation: teaCardEnter 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes teaCardEnter {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 顶部 3px 渐变光带 */
.tea-login-card-accent {
  position: absolute;
  top: 0;
  left: 32px;
  right: 32px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--tea-primary) 20%,
    var(--tea-primary-hover) 50%,
    var(--tea-primary) 80%,
    transparent
  );
  animation: teaAccentGlow 2s ease-out forwards;
}

.tea-login-card-content {
  position: relative;
}

/* 主题切换按钮（卡片右上角） */
.tea-login-theme-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tea-hover-bg);
  border: 1px solid var(--tea-border);
  border-radius: 50%;
  color: var(--tea-text-secondary);
  cursor: pointer;
  transition: all var(--tea-transition-fast);
  z-index: 11;
  padding: 0;
}

.tea-login-theme-toggle:hover {
  color: var(--tea-primary);
  background: var(--tea-primary-supply);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--tea-primary-supply);
}

.tea-login-theme-toggle:active {
  transform: scale(0.92);
}

/* ==================== Logo ==================== */
.tea-login-logo-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px 0 18px;
  height: 72px;
}

.tea-login-logo-glow {
  position: absolute;
  inset: 50% 0 0 0;
  transform: translateY(-50%);
  width: 96px;
  height: 96px;
  margin: auto;
  border-radius: 50%;
  background: radial-gradient(circle, var(--tea-primary-supply) 0%, transparent 70%);
  animation: teaLogoGlow 3s ease-in-out infinite;
}

@keyframes teaLogoGlow {
  0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.7; }
  50% { transform: translateY(-50%) scale(1.15); opacity: 1; }
}

.tea-login-logo-ring {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--tea-primary) 0%, var(--tea-primary-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px var(--tea-primary-supply);
}

.tea-login-logo-ring::after {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1.5px solid var(--tea-primary-supply);
  border-radius: 22px;
  animation: teaRingFadeIn 0.8s 0.3s ease-out both;
}

@keyframes teaRingFadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.tea-login-logo {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ==================== 标题 ==================== */
.tea-login-title {
  background: linear-gradient(90deg, var(--tea-text-primary) 0%, var(--tea-primary) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* v0.6.0 显式使用无衬线字体（移除 serif 引用） */
  font-family: var(--tea-font-family);
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 6px;
  letter-spacing: 4px;
}

.tea-login-subtitle {
  text-align: center;
  font-size: 12px;
  color: var(--tea-text-secondary);
  margin: 0 0 24px;
  letter-spacing: 2px;
}

/* ==================== 表单 ==================== */
.tea-login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tea-login-field {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1.5px solid var(--tea-border);
  padding: 6px 0;
  transition: border-color var(--tea-transition-normal);
}

.tea-login-field:focus-within {
  border-bottom-color: var(--tea-primary);
  box-shadow: 0 1px 0 0 var(--tea-primary-supply);
}

.tea-login-field-icon {
  color: var(--tea-text-tertiary);
  margin-right: 10px;
  font-size: 16px;
  transition: color var(--tea-transition-normal);
  display: flex;
}

.tea-login-field:focus-within .tea-login-field-icon {
  color: var(--tea-primary);
}

.tea-login-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--tea-text-primary);
  padding: 8px 0;
  font-family: inherit;
}

.tea-login-input::placeholder {
  color: var(--tea-text-tertiary);
}

.tea-login-field-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--tea-text-tertiary);
  cursor: pointer;
  border-radius: var(--tea-radius-sm);
  transition: color var(--tea-transition-fast), background var(--tea-transition-fast);
}

.tea-login-field-toggle:hover {
  color: var(--tea-primary);
  background: var(--tea-primary-supply);
}

/* ==================== 按钮（shimmer） ==================== */
.tea-login-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: var(--tea-radius-md);
  background: linear-gradient(135deg, var(--tea-primary) 0%, var(--tea-primary-hover) 100%);
  color: var(--tea-content-inverse);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 6px;
  cursor: pointer;
  margin-top: 4px;
  box-shadow: 0 4px 12px var(--tea-primary-supply);
  transition: transform var(--tea-transition-fast), box-shadow var(--tea-transition-fast);
}

.tea-login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--tea-primary-supply);
}

.tea-login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.tea-login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.tea-login-btn-text {
  position: relative;
  z-index: 1;
}

.tea-login-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  animation: teaShimmer 3s 1s ease-in-out infinite;
}

@keyframes teaShimmer {
  0% { left: -100%; }
  30% { left: 100%; }
  100% { left: 100%; }
}

/* ==================== 底部 ==================== */
.tea-login-footer {
  text-align: center;
  font-size: 11px;
  color: var(--tea-text-tertiary);
  margin: 18px 0 0;
  letter-spacing: 0.5px;
}

/* ==================== 记住密码 ==================== */
.tea-login-remember {
  display: flex;
  justify-content: flex-end;
  margin-top: -8px;
}

.tea-login-remember-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--tea-text-tertiary);
  cursor: pointer;
  user-select: none;
  transition: color var(--tea-transition-fast);
}

.tea-login-remember-label:hover {
  color: var(--tea-text-secondary);
}

.tea-login-remember-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--tea-primary);
  cursor: pointer;
  margin: 0;
}

/* ==================== 减少动效偏好 ==================== */
@media (prefers-reduced-motion: reduce) {
  .tea-login-aurora,
  .tea-login-dot,
  .tea-login-card,
  .tea-login-card-accent,
  .tea-login-btn::after,
  .tea-login-logo-glow,
  .tea-login-logo-ring::after {
    animation: none !important;
  }
  .tea-login-card {
    opacity: 1;
    transform: none;
  }
  .tea-login-card-accent {
    opacity: 1;
    transform: none;
  }
}
</style>
