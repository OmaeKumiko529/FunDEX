<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()

// ── 如果已登录，直接跳回 ──
onMounted(() => {
  if (auth.isLoggedIn) {
    router.replace('/profile')
  }
})

const authMode = ref<'login' | 'register'>('login')
const authEmail = ref('')
const authPassword = ref('')
const authConfirmPassword = ref('')
const authError = ref('')
const authLoading = ref(false)
const authSuccess = ref('')

function toggleAuthMode() {
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
  authError.value = ''
  authSuccess.value = ''
  authConfirmPassword.value = ''
}

async function handleAuth() {
  authError.value = ''
  authSuccess.value = ''

  if (!authEmail.value.trim()) {
    authError.value = '请输入邮箱'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.value.trim())) {
    authError.value = '邮箱格式不正确'
    return
  }
  if (!authPassword.value) {
    authError.value = '请输入密码'
    return
  }
  if (authPassword.value.length < 6) {
    authError.value = '密码长度不能少于6位'
    return
  }
  if (authMode.value === 'register' && authPassword.value !== authConfirmPassword.value) {
    authError.value = '两次输入的密码不一致'
    return
  }

  authLoading.value = true
  try {
    let ok: boolean
    if (authMode.value === 'login') {
      ok = await auth.login(authEmail.value.trim(), authPassword.value)
    } else {
      ok = await auth.register(authEmail.value.trim(), authPassword.value)
    }

    if (ok) {
      authSuccess.value = authMode.value === 'login' ? '登录成功' : '注册成功'
      // 跳转回个人页
      setTimeout(() => router.replace('/profile'), 500)
    } else {
      authError.value = auth.error || (authMode.value === 'login' ? '登录失败' : '注册失败')
    }
  } catch {
    authError.value = '网络错误，请重试'
  } finally {
    authLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <Teleport to="body">
      <header class="page-header">
        <button class="back-btn" @click="router.back()">← 返回</button>
        <h1 class="page-title">{{ authMode === 'login' ? '登录' : '注册' }}</h1>
        <div style="width: 44px;"></div>
      </header>
    </Teleport>

    <div class="auth-content">
      <div class="auth-card">
        <div class="auth-form">
          <input
            v-model="authEmail"
            type="email"
            class="auth-input"
            placeholder="邮箱地址"
            autocomplete="email"
          />
          <input
            v-model="authPassword"
            type="password"
            class="auth-input"
            placeholder="密码（至少6位）"
            autocomplete="current-password"
          />
          <input
            v-if="authMode === 'register'"
            v-model="authConfirmPassword"
            type="password"
            class="auth-input"
            placeholder="确认密码"
            autocomplete="new-password"
          />

          <div v-if="authError" class="auth-error">{{ authError }}</div>
          <div v-if="authSuccess" class="auth-success">{{ authSuccess }}</div>

          <button
            class="auth-submit"
            :disabled="authLoading"
            @click="handleAuth"
          >
            {{ authLoading ? '处理中...' : (authMode === 'login' ? '登录' : '注册') }}
          </button>

          <div class="auth-toggle" @click="toggleAuthMode">
            {{ authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: var(--color-bg, #f5f5f5);
  box-sizing: border-box;
}

.page-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 20px) var(--spacing-lg, 16px);
  padding-top: calc(var(--safe-area-top, 0px) + var(--spacing-xl, 20px));
  background: var(--color-bg, #f5f5f5);
  z-index: 50;
  box-sizing: border-box;
}

.back-btn {
  border: none;
  background: transparent;
  font-size: var(--font-base, 14px);
  color: var(--color-primary, #1890ff);
  cursor: pointer;
  padding: 0;
  width: 44px;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.page-title {
  font-size: var(--font-xl, 18px);
  font-weight: 700;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
  text-align: center;
  flex: 1;
}

.auth-content {
  padding: var(--spacing-xl, 20px) var(--spacing-lg, 16px);
  padding-top: calc(var(--safe-area-top, 0px) + 80px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-card {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-xl, 20px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #e8e8e8);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-base, 14px);
  color: var(--color-text-primary, #1a1a1a);
  background: var(--color-bg, #f5f5f5);
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--duration-fast, 0.15s);
}

.auth-input:focus {
  border-color: var(--color-primary, #1890ff);
}

.auth-input::placeholder {
  color: var(--color-text-muted, #bbb);
}

.auth-error {
  font-size: var(--font-sm, 12px);
  color: var(--color-danger, #ff4d4f);
  text-align: center;
}

.auth-success {
  font-size: var(--font-sm, 12px);
  color: var(--color-success, #52c41a);
  text-align: center;
}

.auth-submit {
  width: 100%;
  padding: 12px 0;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: var(--color-primary, #1890ff);
  color: #fff;
  font-size: var(--font-base, 14px);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast, 0.15s);
  -webkit-tap-highlight-color: transparent;
}

.auth-submit:active {
  opacity: 0.8;
}

.auth-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-toggle {
  text-align: center;
  font-size: var(--font-sm, 12px);
  color: var(--color-primary, #1890ff);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding: 4px 0;
}

.auth-toggle:active {
  opacity: 0.7;
}
</style>