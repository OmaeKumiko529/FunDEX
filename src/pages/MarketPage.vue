<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFundStore } from '@/stores/fundStore'
import FundCard from '@/components/FundCard.vue'
import TipTool from '@/components/TipTool.vue'
import type { LongPressPayload } from '@/types/fund'

const router = useRouter()
const fundStore = useFundStore()

// ── 刷新 key（用于 TransitionGroup 重播入场动画） ──
const refreshKey = ref(0)

// ── 下拉刷新 ──
const refreshing = ref(false)
const pullDistance = ref(0)
const startY = ref(0)
const isPulling = ref(false)

const THRESHOLD = 60

function onTouchStart(e: TouchEvent) {
  if (window.scrollY > 0) return
  const touch = e.touches?.[0]
  if (!touch) return
  startY.value = touch.clientY
  isPulling.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isPulling.value) return
  const touch = e.touches?.[0]
  if (!touch) return
  const diff = touch.clientY - startY.value
  if (diff > 0) {
    pullDistance.value = Math.min(diff * 0.5, 120)
  }
}

function smoothReset() {
  const start = performance.now()
  const initial = pullDistance.value
  const duration = 150 // ms

  if (initial === 0) return

  function step(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    // ease-out quadratic
    const eased = 1 - Math.pow(1 - progress, 2)
    pullDistance.value = initial * (1 - eased)
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }
  requestAnimationFrame(step)
}

function onTouchEnd() {
  if (pullDistance.value >= THRESHOLD) {
    refreshing.value = true
    fundStore.loadFunds().finally(() => {
      refreshing.value = false
      pullDistance.value = 0
      refreshKey.value++
    })
  } else if (pullDistance.value > 0) {
    smoothReset()
  }
  isPulling.value = false
}

// ── 详情跳转 ──
function goDetail(fundCode: string) {
  router.push(`/fund/${fundCode}`)
}

// ── 搜索页跳转 ──
function goSearch() {
  router.push('/search')
}

// ── TipTool 长按菜单 ──
const tipToolVisible = ref(false)
const tipToolFund = ref<{ fundCode: string; fundName: string } | null>(null)
const tipToolPosition = ref({ x: 0, y: 0 })

function onLongPress(payload: LongPressPayload) {
  tipToolFund.value = { fundCode: payload.fundCode, fundName: payload.fundName }
  tipToolPosition.value = { x: payload.x, y: payload.y }
  tipToolVisible.value = true
}

function closeTipTool() {
  tipToolVisible.value = false
}

function onTogglePin(fundCode: string) {
  fundStore.togglePin(fundCode)
  refreshKey.value++
}

function onRemove(fundCode: string) {
  fundStore.removeFund(fundCode)
  refreshKey.value++
}

onMounted(() => {
  fundStore.loadFunds().then(() => {
    refreshKey.value++
  })
})
</script>

<template>
  <div
    class="market-page"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- 下拉刷新指示器 -->
    <div
      class="pull-indicator"
      :class="{ visible: pullDistance > 0 || refreshing }"
      :style="{ height: (refreshing ? 60 : pullDistance) + 'px' }"
    >
      <div v-if="refreshing" class="pull-spinner"></div>
      <span v-else class="pull-text" :class="{ ready: pullDistance >= THRESHOLD }">
        {{ pullDistance >= THRESHOLD ? '释放刷新' : '下拉刷新' }}
      </span>
    </div>

    <!-- 页面头部（固定，Teleport 到 body 避免受 Transition transform 影响） -->
    <Teleport to="body">
      <header class="page-header">
        <h1 class="page-title">行情</h1>
        <button class="add-btn" title="添加基金" @click="goSearch">＋</button>
      </header>
    </Teleport>

    <!-- 加载中（首次） -->
    <Transition name="fade">
      <div v-if="fundStore.loading && fundStore.funds.length === 0" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <div v-if="fundStore.error && fundStore.funds.length === 0" class="error-state">
      {{ fundStore.error }}
      <button class="retry-btn" @click="fundStore.loadFunds()">重试</button>
    </div>

    <!-- 基金列表（TransitionGroup 支持入场/离场/排序动画） -->
    <TransitionGroup v-if="!fundStore.loading && !fundStore.error && fundStore.funds.length > 0" name="list" tag="div" class="fund-list" :key="refreshKey">
      <div
        v-for="(item, index) in fundStore.funds"
        :key="item.info.fund_code"
        class="fund-card-wrapper"
        :style="{ '--index': index }"
      >
        <FundCard
          :fund-code="item.info.fund_code"
          :fund-name="item.info.fund_name"
          :unit-nav="item.latestNav?.unit_nav ?? null"
          :daily-growth-rate="item.latestNav?.daily_growth_rate ?? null"
          :nav-date="item.latestNav?.nav_date ?? null"
          :pinned="fundStore.isPinned(item.info.fund_code)"
          @click="goDetail"
          @longpress="onLongPress"
        />
      </div>
    </TransitionGroup>

    <!-- TipTool 长按弹出菜单 -->
    <TipTool
      :visible="tipToolVisible"
      :fund-code="tipToolFund?.fundCode ?? ''"
      :fund-name="tipToolFund?.fundName ?? ''"
      :is-pinned="fundStore.isPinned(tipToolFund?.fundCode ?? '')"
      :position="tipToolPosition"
      @close="closeTipTool"
      @toggle-pin="onTogglePin"
      @remove="onRemove"
    />
  </div>
</template>

<style scoped>
.market-page {
  padding: var(--spacing-xl, 20px) var(--spacing-lg, 16px);
  padding-top: calc(var(--safe-area-top, 0px) + 76px);
  padding-bottom: calc(var(--nav-height, 10vh) + var(--spacing-xl, 20px));
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: var(--color-bg, #f5f5f5);
  box-sizing: border-box;
  position: relative;
}

/* ── 下拉刷新 ── */
.pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: height 0.15s var(--ease-out, ease);
  color: var(--color-text-tertiary, #999);
  font-size: var(--font-sm, 12px);
}

.pull-text {
  transition: color var(--duration-fast, 0.15s);
}

.pull-text.ready {
  color: var(--color-primary, #1890ff);
  font-weight: 600;
}

.pull-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border, #e8e8e8);
  border-top-color: var(--color-primary, #1890ff);
  border-radius: var(--radius-full, 50%);
  animation: spin 0.8s linear infinite;
}

/* ── 头部（固定） ── */
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

.add-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full, 50%);
  border: none;
  background: var(--color-primary, #1890ff);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-normal, 0.2s) var(--ease-out, ease);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.add-btn:active {
  background: var(--color-primary-active, #096dd9);
  transform: scale(0.93);
}

/* ── 加载状态 ── */
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

/* ── 错误状态 ── */
.error-state {
  text-align: center;
  padding: 60px 0;
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

/* ── 基金列表（TransitionGroup） ── */
.fund-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

/* 入场动画：交错 fadeInUp */
.fund-card-wrapper {
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
  animation-delay: calc(var(--index, 0) * 0.05s);
}

/* TransitionGroup 过渡 */
.list-enter-active {
  transition: all var(--duration-slow, 0.3s) var(--ease-out, ease);
}

.list-leave-active {
  transition: all var(--duration-normal, 0.2s) var(--ease-out, ease);
  position: absolute;
  width: 100%;
  left: 0;
}

.list-move {
  transition: transform var(--duration-slow, 0.3s) var(--ease-out, ease);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* ── VNode 淡入淡出过渡（用于 loading spinner） ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal, 0.2s) var(--ease-out, ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>