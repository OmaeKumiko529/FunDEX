<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFundStore } from '@/stores/fundStore'
import { useAuthStore } from '@/stores/authStore'
import avatarSrc from '@/assests/Avatar.webp'

const router = useRouter()
const fundStore = useFundStore()
const auth = useAuthStore()

// ── 本地持久化数据 ──
const pinnedCodes = ref<string[]>([])
const totalFundsCount = ref(0)

// ── 已置顶基金详情列表 ──
const pinnedFunds = computed(() => {
  return fundStore.funds.filter((f) => pinnedCodes.value.includes(f.info.fund_code))
})

// ── 自选管理展开/折叠 ──
const showPinned = ref(true)

// ── 加载数据 ──
const loading = ref(false)
const error = ref<string | null>(null)

async function loadProfile() {
  loading.value = true
  error.value = null
  try {
    await fundStore.loadFunds()
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_codes') || '[]') as string[]
      pinnedCodes.value = stored
    } catch {
      pinnedCodes.value = []
    }
    totalFundsCount.value = fundStore.funds.length
  } catch {
    error.value = '数据加载失败，请重试'
  } finally {
    loading.value = false
  }
}

// ── 取消置顶 ──
function onTogglePin(fundCode: string) {
  fundStore.togglePin(fundCode)
  try {
    const stored = JSON.parse(localStorage.getItem('pinned_codes') || '[]') as string[]
    pinnedCodes.value = stored
  } catch {
    pinnedCodes.value = []
  }
}

// ── 清除所有已移除记录 ──
function clearRemovedRecords() {
  if (confirm('确定要清除所有已移除的基金记录吗？')) {
    localStorage.removeItem('removed_codes')
    fundStore.loadFunds()
  }
}

// ── 清除本地缓存 ──
function clearAllCache() {
  if (confirm('确定要清除所有本地缓存数据吗？\n（置顶设置、移除记录等将被清除）')) {
    localStorage.clear()
    pinnedCodes.value = []
    fundStore.loadFunds()
  }
}

// ── 刷新全部数据 ──
function refreshAll() {
  fundStore.loadFunds().then(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_codes') || '[]') as string[]
      pinnedCodes.value = stored
    } catch {
      pinnedCodes.value = []
    }
    totalFundsCount.value = fundStore.funds.length
  })
}

// ── 跳转到登录/注册页面 ──
function goToAuth() {
  router.push('/auth')
}

// ═══════════════════════════════════════════════
//  Bio 编辑
// ═══════════════════════════════════════════════

const editingBio = ref(false)
const editingName = ref(false)
const bioDraft = ref('')
const nameDraft = ref('')

function startEditBio() {
  bioDraft.value = auth.bio || ''
  editingBio.value = true
}

async function saveBio() {
  const ok = await auth.updateProfile({ bio: bioDraft.value })
  if (ok) editingBio.value = false
}

function cancelEditBio() {
  editingBio.value = false
  bioDraft.value = auth.bio || ''
}

function startEditName() {
  nameDraft.value = auth.displayName || ''
  editingName.value = true
}

async function saveName() {
  const ok = await auth.updateProfile({ display_name: nameDraft.value })
  if (ok) editingName.value = false
}

function cancelEditName() {
  editingName.value = false
  nameDraft.value = auth.displayName || ''
}

// ═══════════════════════════════════════════════
//  头像上传
// ═══════════════════════════════════════════════

const fileInput = ref<HTMLInputElement | null>(null)

function triggerAvatarUpload() {
  fileInput.value?.click()
}

async function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]!
  const ok = await auth.uploadAvatar(file)
  if (!ok) alert(auth.error || '头像上传失败')
  target.value = ''
}

// ═══════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════

onMounted(async () => {
  await auth.fetchProfile()
  loadProfile()
})
</script>

<template>
  <div class="profile-page">
    <Teleport to="body">
      <header class="page-header">
        <h1 class="page-title">我的</h1>
      </header>
    </Teleport>

    <Transition name="fade">
      <div v-if="loading && fundStore.funds.length === 0" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
    </Transition>

    <div v-if="error" class="error-state">
      {{ error }}
      <button class="retry-btn" @click="loadProfile()">重试</button>
    </div>

    <div v-if="!loading && !error" class="profile-content">
      <!-- ── 已登录：用户概览卡片 ── -->
      <section v-if="auth.isLoggedIn" class="profile-card overview-card">
        <div class="avatar-area" @click="triggerAvatarUpload">
          <img class="avatar" :src="auth.avatarUrl || avatarSrc" alt="头像" />
          <div class="avatar-overlay">
            <span class="avatar-overlay-text">更换头像</span>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="handleAvatarChange"
          />
          <div class="user-info">
            <template v-if="editingName">
              <div class="edit-name-row">
                <input
                  v-model="nameDraft"
                  class="edit-input name-input"
                  placeholder="输入昵称"
                  maxlength="30"
                />
                <button class="edit-btn save-btn" @click="saveName">✓</button>
                <button class="edit-btn cancel-btn" @click="cancelEditName">✕</button>
              </div>
            </template>
            <template v-else>
              <span class="user-name" @click="startEditName">{{ auth.displayName }}</span>
            </template>

            <template v-if="editingBio">
              <div class="edit-bio-row">
                <textarea
                  v-model="bioDraft"
                  class="edit-textarea"
                  placeholder="写一段个人简介..."
                  rows="2"
                  maxlength="200"
                ></textarea>
                <div class="edit-bio-actions">
                  <button class="edit-btn save-btn" @click="saveBio">保存</button>
                  <button class="edit-btn cancel-btn" @click="cancelEditBio">取消</button>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="user-subtitle" @click="startEditBio">
                {{ auth.bio || '点击添加个人简介...' }}
              </span>
            </template>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-value">{{ totalFundsCount }}</span>
            <span class="stat-label">关注基金</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ pinnedCodes.length }}</span>
            <span class="stat-label">已置顶</span>
          </div>
        </div>
      </section>

      <!-- ── 未登录时显示默认头像 + 登录按钮 ── -->
      <section v-if="!auth.isLoggedIn" class="profile-card overview-card">
        <div class="avatar-area">
          <img class="avatar" :src="avatarSrc" alt="头像" />
          <div class="user-info">
            <span class="user-name">未登录</span>
            <span class="user-subtitle">登录后可管理您的基金关注列表</span>
          </div>
        </div>
        <button class="login-btn" @click="goToAuth">登录 / 注册</button>
        <div class="stats-row" style="margin-top: 0; padding-top: 0;">
          <div class="stat-item">
            <span class="stat-value">{{ totalFundsCount }}</span>
            <span class="stat-label">关注基金</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ pinnedCodes.length }}</span>
            <span class="stat-label">已置顶</span>
          </div>
        </div>
      </section>

      <!-- ── 已登录：退出登录 ── -->
      <section v-if="auth.isLoggedIn" class="profile-card">
        <h3 class="section-title" style="margin-bottom: 8px;">账户</h3>
        <div class="action-list">
          <div class="action-item" @click="auth.logout()">
            <span class="action-icon">🚪</span>
            <span class="action-text">退出登录</span>
          </div>
        </div>
      </section>

      <!-- ── 自选管理 ── -->
      <section class="profile-card">
        <div class="section-header" @click="showPinned = !showPinned">
          <h3 class="section-title">自选管理</h3>
          <span class="toggle-icon" :class="{ open: showPinned }">▼</span>
        </div>
        <Transition name="collapse">
          <div v-if="showPinned" class="pinned-list">
            <div v-if="pinnedFunds.length === 0" class="empty-hint">
              暂无置顶基金，在行情页长按基金可置顶
            </div>
            <div
              v-for="pf in pinnedFunds"
              :key="pf.info.fund_code"
              class="pinned-item"
            >
              <div class="pinned-info">
                <span class="pinned-name">{{ pf.info.fund_name }}</span>
                <span class="pinned-code">{{ pf.info.fund_code }}</span>
              </div>
              <button class="unpin-btn" @click="onTogglePin(pf.info.fund_code)">
                取消置顶
              </button>
            </div>
          </div>
        </Transition>
      </section>

      <!-- ── 数据管理 ── -->
      <section class="profile-card">
        <h3 class="section-title" style="margin-bottom: 8px;">数据管理</h3>
        <div class="action-list">
          <button class="action-item" @click="refreshAll">
            <span class="action-icon">🔄</span>
            <span class="action-text">刷新全部数据</span>
          </button>
          <button class="action-item" @click="clearRemovedRecords">
            <span class="action-icon">🗑️</span>
            <span class="action-text">清除移除记录</span>
          </button>
          <button class="action-item" @click="clearAllCache">
            <span class="action-icon">🧹</span>
            <span class="action-text">清除所有缓存</span>
          </button>
        </div>
      </section>

      <!-- ── 关于 ── -->
      <section class="profile-card">
        <h3 class="section-title" style="margin-bottom: 8px;">关于</h3>
        <div class="about-info">
          <div class="about-row">
            <span class="about-label">应用名称</span>
            <span class="about-value">FunDEX</span>
          </div>
          <div class="about-row">
            <span class="about-label">版本</span>
            <span class="about-value">0.0.2 Alpha</span>
          </div>
        </div>
      </section>

      <div class="bottom-safe"></div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: var(--color-bg, #f5f5f5);
  box-sizing: border-box;
  position: relative;
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

.page-title {
  font-size: var(--font-3xl, 24px);
  font-weight: 700;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
}

.profile-content {
  padding: var(--spacing-xl, 20px) var(--spacing-lg, 16px);
  padding-top: calc(var(--safe-area-top, 0px) + 76px);
  padding-bottom: calc(var(--nav-height, 10vh) + var(--spacing-xl, 20px));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-card {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
}

.profile-card:nth-of-type(1) { animation-delay: 0.05s; }
.profile-card:nth-of-type(2) { animation-delay: 0.1s; }
.profile-card:nth-of-type(3) { animation-delay: 0.15s; }
.profile-card:nth-of-type(4) { animation-delay: 0.2s; }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--color-text-tertiary, #999);
  gap: 12px;
  font-size: var(--font-base, 14px);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e8e8e8);
  border-top-color: var(--color-primary, #1890ff);
  border-radius: var(--radius-full, 50%);
  animation: spin 0.8s linear infinite;
}

.error-state {
  text-align: center;
  padding: 60px var(--spacing-lg, 16px);
  color: var(--color-danger, #ff4d4f);
  font-size: var(--font-base, 14px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.retry-btn {
  padding: 8px 24px;
  border: 1px solid var(--color-danger, #ff4d4f);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: var(--color-danger, #ff4d4f);
  font-size: var(--font-base, 14px);
  cursor: pointer;
}

.retry-btn:active {
  background: rgba(255, 77, 79, 0.05);
}

/* ── 登录按钮（未登录状态下） ── */
.login-btn {
  width: 100%;
  padding: 12px 0;
  margin: 12px 0 16px;
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

.login-btn:active {
  opacity: 0.8;
}

/* ═════════════════════════════════════════════
   操作列表
   ═════════════════════════════════════════════ */

.action-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  padding: 12px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: opacity var(--duration-fast, 0.15s);
  -webkit-tap-highlight-color: transparent;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.action-item:last-child {
  border-bottom: none;
}

.action-item:active {
  opacity: 0.6;
}

.action-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.action-text {
  font-size: var(--font-base, 14px);
  color: var(--color-text-primary, #1a1a1a);
}

/* ── 用户概览卡片 ── */
.overview-card {
  padding: var(--spacing-xl, 20px);
}

.avatar-area {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 16px);
  margin-bottom: var(--spacing-lg, 16px);
  position: relative;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full, 50%);
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-area:has(.avatar-overlay) {
  cursor: pointer;
}

.avatar-area:has(.avatar-overlay) .avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full, 50%);
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--duration-fast, 0.15s);
}

.avatar-area:has(.avatar-overlay):active .avatar-overlay {
  opacity: 1;
}

.avatar-overlay-text {
  color: #fff;
  font-size: 10px;
  text-align: center;
  line-height: 1.2;
  padding: 2px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: var(--font-lg, 16px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  cursor: default;
  word-break: break-word;
}

.user-subtitle {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-tertiary, #999);
  cursor: pointer;
  word-break: break-word;
}

.stats-row {
  display: flex;
  gap: 24px;
  padding-top: var(--spacing-lg, 16px);
  border-top: 1px solid var(--color-border-light, #f0f0f0);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.stat-value {
  font-size: var(--font-3xl, 24px);
  font-weight: 700;
  color: var(--color-primary, #1890ff);
  line-height: 1.2;
}

.stat-label {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-tertiary, #999);
}

/* ═════════════════════════════════════════════
   编辑模式
   ═════════════════════════════════════════════ */

.edit-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-primary, #1890ff);
  border-radius: var(--radius-sm, 6px);
  font-size: var(--font-base, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  background: var(--color-bg, #f5f5f5);
  outline: none;
  min-width: 0;
}

.edit-bio-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}

.edit-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-primary, #1890ff);
  border-radius: var(--radius-sm, 6px);
  font-size: var(--font-xs, 11px);
  color: var(--color-text-primary, #1a1a1a);
  background: var(--color-bg, #f5f5f5);
  outline: none;
  resize: none;
  box-sizing: border-box;
  line-height: 1.5;
}

.edit-bio-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.edit-btn {
  padding: 3px 10px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: var(--font-xs, 11px);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity var(--duration-fast, 0.15s);
}

.edit-btn:active {
  opacity: 0.7;
}

.save-btn {
  background: var(--color-primary, #1890ff);
  color: #fff;
}

.cancel-btn {
  background: var(--color-border, #e8e8e8);
  color: var(--color-text-secondary, #666);
}

/* ── 自选管理 ── */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.section-title {
  font-size: var(--font-md, 15px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
}

.toggle-icon {
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
  transition: transform var(--duration-normal, 0.2s) var(--ease-out, ease);
}

.toggle-icon.open {
  transform: rotate(180deg);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all var(--duration-normal, 0.2s) var(--ease-out, ease);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}

.pinned-list {
  margin-top: var(--spacing-md, 12px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-hint {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-tertiary, #999);
  text-align: center;
  padding: 16px 0;
}

.pinned-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.pinned-item:last-child {
  border-bottom: none;
}

.pinned-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pinned-name {
  font-size: var(--font-base, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pinned-code {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-muted, #bbb);
}

.unpin-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--color-border, #e8e8e8);
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  font-size: var(--font-xs, 11px);
  color: var(--color-text-secondary, #666);
  cursor: pointer;
  transition: all var(--duration-fast, 0.15s);
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.unpin-btn:active {
  background: var(--color-border-light, #f0f0f0);
  border-color: var(--color-text-muted, #bbb);
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.about-label {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-tertiary, #999);
}

.about-value {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-primary, #1a1a1a);
  font-weight: 500;
}

.bottom-safe {
  height: calc(20px + var(--safe-area-bottom, 0px));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal, 0.2s) var(--ease-out, ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>