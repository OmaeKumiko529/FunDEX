import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { UserPublic, AuthResponse } from '@/types/user'

export const useAuthStore = defineStore('auth', () => {
  // ── 状态 ──
  const user = ref<UserPublic | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── 计算属性 ──
  const isLoggedIn = computed(() => !!user.value && !!token.value)
  const displayName = computed(() => user.value?.display_name || user.value?.email?.split('@')[0] || '用户')
  const avatarUrl = computed(() => user.value?.avatar_url || null)
  const bio = computed(() => user.value?.bio || null)

  // ── API 基础地址 ──
  const API_BASE = ''

  // ── 工具函数 ──
  function saveToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('auth_token', newToken)
  }

  function clearToken() {
    token.value = null
    localStorage.removeItem('auth_token')
  }

  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    return headers
  }

  // ── 动作 ──

  /** 注册 */
  async function register(email: string, password: string, display_name?: string) {
    loading.value = true
    error.value = null
    try {
      const body: Record<string, string> = { email, password }
      if (display_name) body.display_name = display_name
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '注册失败')
      }
      const authData = data as AuthResponse
      user.value = authData.user
      saveToken(authData.token)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '注册失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 登录 */
  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '登录失败')
      }
      const authData = data as AuthResponse
      user.value = authData.user
      saveToken(authData.token)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 */
  async function logout() {
    try {
      if (token.value) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token.value}` },
        })
      }
    } catch {
      // 即使请求失败也清除本地状态
    } finally {
      user.value = null
      clearToken()
    }
  }

  /** 获取当前用户信息（恢复登录态） */
  async function fetchProfile() {
    if (!token.value) {
      user.value = null
      return
    }
    loading.value = true
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token.value}` },
      })
      if (!res.ok) {
        throw new Error('Token 无效')
      }
      const data = await res.json()
      user.value = data.user
    } catch {
      user.value = null
      clearToken()
    } finally {
      loading.value = false
    }
  }

  /** 更新个人资料 */
  async function updateProfile(updates: { display_name?: string; bio?: string }) {
    if (!token.value) return false
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '更新失败')
      }
      user.value = data.user
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '更新失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 上传头像 */
  async function uploadAvatar(file: File) {
    if (!token.value) return false
    loading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.value}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '上传失败')
      }
      user.value = data.user
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '上传失败'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    user, token, loading, error,
    isLoggedIn, displayName, avatarUrl, bio,
    register, login, logout, fetchProfile, updateProfile, uploadAvatar,
  }
})