<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFundStore } from '@/stores/fundStore'
import FundCard from '@/components/FundCard.vue'

const router = useRouter()
const fundStore = useFundStore()

// ── 下拉刷新 ──
const refreshing = ref(false)
const pullDistance = ref(0)
const startY = ref(0)
const isPulling = ref(false)

const THRESHOLD = 60 // 触发刷新的下拉距离

function onTouchStart(e: TouchEvent) {
  if (window.scrollY > 0) return // 不在顶部不触发
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
    pullDistance.value = Math.min(diff * 0.5, 120) // 阻尼效果
  }
}

function onTouchEnd() {
  if (pullDistance.value >= THRESHOLD) {
    refreshing.value = true
    fundStore.loadFunds().finally(() => {
      refreshing.value = false
      pullDistance.value = 0
    })
  } else {
    pullDistance.value = 0
  }
  isPulling.value = false
}

function goDetail(fundCode: string) {
  router.push(`/fund/${fundCode}`)
}

onMounted(() => {
  fundStore.loadFunds()
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

    <!-- 页面头部 -->
    <header class="page-header">
      <h1 class="page-title">行情</h1>
      <button class="add-btn" title="添加基金">＋</button>
    </header>

    <!-- 加载中（首次） -->
    <div v-if="fundStore.loading && fundStore.funds.length === 0" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="fundStore.error && fundStore.funds.length === 0" class="error-state">
      {{ fundStore.error }}
      <button class="retry-btn" @click="fundStore.loadFunds()">重试</button>
    </div>

    <!-- 基金列表 -->
    <div v-else class="fund-list">
      <div
        v-for="(item, index) in fundStore.funds"
        :key="item.info.fund_code"
        class="fund-card-wrapper"
        :style="{ animationDelay: `${index * 0.05}s` }"
        @click="goDetail(item.info.fund_code)"
      >
        <FundCard
          :fund-code="item.info.fund_code"
          :fund-name="item.info.fund_name"
          :unit-nav="item.latestNav?.unit_nav ?? null"
          :daily-growth-rate="item.latestNav?.daily_growth_rate ?? null"
          :nav-date="item.latestNav?.nav_date ?? null"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-page {
  padding: var(--spacing-xl, 20px) var(--spacing-lg, 16px);
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
  transition: height var(--duration-normal, 0.2s) var(--ease-out, ease);
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

/* ── 头部 ── */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl, 20px);
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

/* ── 基金列表 ── */
.fund-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fund-card-wrapper {
  cursor: pointer;
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
}
</style>
