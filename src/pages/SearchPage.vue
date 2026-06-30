<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFundStore } from '@/stores/fundStore'
import FundCard from '@/components/FundCard.vue'
import type { SearchResult } from '@/types/fund'

const router = useRouter()
const fundStore = useFundStore()

const keyword = ref('')
const results = ref<SearchResult[]>([])
const searching = ref(false)
const fetching = ref(false)        // 爬虫进行中
const fetchTargetCode = ref('')    // 正在拉取的代码
const noResultForCode = ref('')    // 搜索代码但 DB 中不存在

// ── 防抖搜索 ──
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  // 重置状态
  noResultForCode.value = ''
  fetchTargetCode.value = ''

  if (!val.trim()) {
    results.value = []
    return
  }

  debounceTimer = setTimeout(() => doSearch(val.trim()), 300)
})

async function doSearch(val: string) {
  searching.value = true
  try {
    // 如果输入的是纯数字，先检查是否精确代码匹配
    if (/^\d{6}$/.test(val)) {
      const info = await fundStore.checkFundExists(val)
      if (info) {
        // DB 中有该基金，获取最新净值
        const nav = await fundStore.getFundLatestNav(val)
        results.value = [{
          info,
          latestNav: nav,
        }]
        return
      }
      // DB 中没有，记录下代码用于触发爬虫
      noResultForCode.value = val
      results.value = []
      return
    }

    // 名称模糊搜索（同时也当代码模糊搜索用）
    const data = await fundStore.searchFunds(val)
    results.value = data
  } finally {
    searching.value = false
  }
}

// ── 触发爬虫 ──
async function startFetch() {
  const code = noResultForCode.value
  if (!code) return
  fetching.value = true
  try {
    const ok = await fundStore.fetchFundByCrawler(code)
    if (ok) {
      // 爬虫完成，重新查询
      const info = await fundStore.checkFundExists(code)
      if (info) {
        const nav = await fundStore.getFundLatestNav(code)
        results.value = [{
          info,
          latestNav: nav,
        }]
        noResultForCode.value = ''
      } else {
        // 爬取后仍未找到，可能是无效基金代码
        noResultForCode.value = ''
        results.value = []
        alert('未找到该基金，请确认代码是否正确')
      }
    } else {
      alert('数据获取失败，请稍后重试')
    }
  } finally {
    fetching.value = false
  }
}

// ── 跳转详情 ──
function goDetail(fundCode: string) {
  router.push(`/fund/${fundCode}`)
}

// ── 返回 ──
function goBack() {
  router.back()
}
</script>

<template>
  <div class="search-page">
    <!-- 顶部搜索栏 -->
    <header class="search-header">
      <button class="back-btn" @click="goBack" title="返回">←</button>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="keyword"
          class="search-input"
          type="search"
          placeholder="输入基金代码或名称"
          autofocus
        />
        <button
          v-if="keyword"
          class="clear-btn"
          @click="keyword = ''"
          title="清除"
        >✕</button>
      </div>
    </header>

    <!-- 搜索中 -->
    <div v-if="searching" class="state-box">
      <div class="spinner"></div>
      <span>搜索中...</span>
    </div>

    <!-- 搜索结果为空（有输入但无结果） -->
    <div
      v-else-if="keyword && results.length === 0 && !searching && !noResultForCode"
      class="state-box"
    >
      <span class="empty-icon">📭</span>
      <span>未找到相关基金</span>
    </div>

    <!-- 代码未在 DB 中找到，可触发爬虫 -->
    <div
      v-else-if="noResultForCode"
      class="fetch-prompt"
    >
      <p class="fetch-text">
        基金代码 <strong>{{ noResultForCode }}</strong> 尚未收录
      </p>
      <button
        class="fetch-btn"
        :disabled="fetching"
        @click="startFetch"
      >
        <span v-if="fetching" class="fetch-spinner"></span>
        <span>{{ fetching ? '正在获取数据...' : '点击获取数据' }}</span>
      </button>
      <p class="fetch-hint">首次获取可能需要 10~30 秒</p>
    </div>

    <!-- 搜索结果列表 -->
    <div v-else-if="results.length > 0" class="result-list">
      <div
        v-for="(item, index) in results"
        :key="item.info.fund_code"
        class="result-item"
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

    <!-- 初始提示 -->
    <div v-else class="state-box hint-box">
      <span class="hint-icon">🔎</span>
      <span>输入基金代码或名称搜索</span>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: var(--color-bg, #f5f5f5);
  display: flex;
  flex-direction: column;
}

/* ── 顶部搜索栏 ── */
.search-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  background: var(--color-white, #ffffff);
  border-bottom: 1px solid var(--color-border, #e8e8e8);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  font-size: 20px;
  color: var(--color-text-primary, #1a1a1a);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full, 50%);
  -webkit-tap-highlight-color: transparent;
}

.back-btn:active {
  background: var(--color-border-light, #f0f0f0);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--color-bg, #f5f5f5);
  border-radius: var(--radius-md, 8px);
  padding: 0 var(--spacing-md, 12px);
  gap: var(--spacing-xs, 4px);
}

.search-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: var(--font-base, 14px);
  color: var(--color-text-primary, #1a1a1a);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.search-input::placeholder {
  color: var(--color-text-tertiary, #999);
}

.clear-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--color-text-muted, #bbb);
  color: #fff;
  font-size: 12px;
  border-radius: var(--radius-full, 50%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.clear-btn:active {
  opacity: 0.8;
}

/* ── 状态容器 ── */
.state-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md, 12px);
  padding: 60px var(--spacing-xl, 20px);
  color: var(--color-text-tertiary, #999);
  font-size: var(--font-base, 14px);
}

.hint-icon {
  font-size: 36px;
}

.empty-icon {
  font-size: 36px;
}

/* ── 爬虫触发提示 ── */
.fetch-prompt {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg, 16px);
  padding: 60px var(--spacing-xl, 20px);
  text-align: center;
}

.fetch-text {
  font-size: var(--font-base, 14px);
  color: var(--color-text-secondary, #666);
  margin: 0;
}

.fetch-text strong {
  color: var(--color-text-primary, #1a1a1a);
}

.fetch-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: 12px 32px;
  background: var(--color-primary, #1890ff);
  color: #fff;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-base, 14px);
  cursor: pointer;
  transition: background var(--duration-normal, 0.2s);
  -webkit-tap-highlight-color: transparent;
}

.fetch-btn:active:not(:disabled) {
  background: var(--color-primary-active, #096dd9);
}

.fetch-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.fetch-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: var(--radius-full, 50%);
  animation: spin 0.8s linear infinite;
}

.fetch-hint {
  font-size: var(--font-sm, 11px);
  color: var(--color-text-muted, #bbb);
  margin: 0;
}

/* ── 结果列表 ── */
.result-list {
  flex: 1;
  padding: var(--spacing-lg, 16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
  cursor: pointer;
}

/* ── spinner ── */
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border, #e8e8e8);
  border-top-color: var(--color-primary, #1890ff);
  border-radius: var(--radius-full, 50%);
  animation: spin 0.8s linear infinite;
}

/* ── 入场动画已在全局定义 ── */
</style>