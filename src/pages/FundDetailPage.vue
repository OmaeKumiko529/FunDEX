<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFundStore } from '@/stores/fundStore'
import type { FundInfo, FundNav } from '@/types/fund'
import FundCard from '@/components/FundCard.vue'
import FundNavChart from '@/components/FundNavChart.vue'
import type { ChartPoint } from '@/components/FundNavChart.vue'

// 使用相对路径，由 Vite Dev Server 的 proxy 转发到后端
// 本机、WiFi ADB、虚拟机三种场景都可用，无需修改配置
const API_BASE = ''

const route = useRoute()
const router = useRouter()
const fundStore = useFundStore()

// ── 当前基金代码（从路由获取） ──
const fundCode = computed(() => route.params.fundCode as string)

// ── 独立 fallback 数据（当 fundStore.funds 中找不到时） ──
const fallbackInfo = ref<FundInfo | null>(null)
const fallbackNav = ref<FundNav | null>(null)

// ── 当前基金数据 ──
const currentFund = computed(() => {
  const fromStore = fundStore.funds.find((f) => f.info.fund_code === fundCode.value)
  if (fromStore) return fromStore
  if (!fallbackInfo.value) return null
  return { info: fallbackInfo.value, latestNav: fallbackNav.value }
})

// ── 是否为 ETF/LOF 场内品种 ──
const isTraded = ref(false)

// ── 时间范围 ──
type RangeKey = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'
const selectedRange = ref<RangeKey>('all')
const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: '1w', label: '1周' },
  { key: '1m', label: '1个月' },
  { key: '3m', label: '3个月' },
  { key: '6m', label: '6个月' },
  { key: '1y', label: '1年' },
  { key: 'all', label: '全部' },
]

function getRangeDate(range: RangeKey): string | null {
  if (range === 'all') return null

  const now = new Date()
  switch (range) {
    case '1w':
      now.setDate(now.getDate() - 7)
      break
    case '1m':
      now.setMonth(now.getMonth() - 1)
      break
    case '3m':
      now.setMonth(now.getMonth() - 3)
      break
    case '6m':
      now.setMonth(now.getMonth() - 6)
      break
    case '1y':
      now.setFullYear(now.getFullYear() - 1)
      break
  }
  return now.toISOString().split('T')[0] ?? null
}

// ── 图表数据（按选中范围过滤） ──
const chartPoints = computed<ChartPoint[]>(() => {
  const history = fundStore.navHistory[fundCode.value]
  if (!history || history.length === 0) return []

  const since = getRangeDate(selectedRange.value)
  const filtered = since
    ? history.filter((h) => h.nav_date >= since)
    : history

  return filtered.map((h) => ({
    nav_date: h.nav_date,
    unit_nav: h.unit_nav,
    accum_nav: h.accum_nav,
  }))
})

// ── ETF/LOF K线数据（按选中范围过滤） ──
const marketPoints = computed(() => {
  const market = fundStore.marketHistory[fundCode.value]
  if (!market || market.length === 0) return []

  const since = getRangeDate(selectedRange.value)
  return since
    ? market.filter((m) => m.trade_date >= since).sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    : [...market].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
})

// ── 是否显示K线：仅 ETF/LOF 且范围为 1周 或 1月 ──
const showCandle = computed(() =>
  isTraded.value && (selectedRange.value === '1w' || selectedRange.value === '1m')
)

const chartLoading = computed(() => fundStore.loading)

// ── 选择时间范围 ──
function selectRange(key: RangeKey) {
  selectedRange.value = key
}

// ── 返回 ──
function goBack() {
  router.back()
}

// ── 获取 fallback 数据（store 中没有时使用） ──
async function loadFallbackData(code: string) {
  try {
    const infoRes = await fetch(`${API_BASE}/api/fund-info/${code}`)
    if (!infoRes.ok) return
    const infoData = await infoRes.json()
    if (!infoData.data) return
    fallbackInfo.value = infoData.data

    const navRes = await fetch(`${API_BASE}/api/fund-nav/${code}/latest`)
    if (navRes.ok) {
      const navData = await navRes.json()
      fallbackNav.value = navData.data ?? null
    }
  } catch {
    // fallback 失败不阻塞页面
  }
}

// ── 加载数据 ──
onMounted(() => {
  if (!fundCode.value) return

  // 检查 store 中是否有该基金数据
  const inStore = fundStore.funds.find((f) => f.info.fund_code === fundCode.value)
  if (!inStore) {
    // fallback：独立请求基金信息和最新净值
    loadFallbackData(fundCode.value)
  }

  // 1) 优先从 fundStore 缓存拿 is_traded
  const cached = fundStore.funds.find((f) => f.info.fund_code === fundCode.value)
  if (cached) {
    isTraded.value = cached.info.is_traded === 1
  }

  // 2) 独立请求该基金信息以获得最新的 is_traded
  fetch(`${API_BASE}/api/fund-info/${fundCode.value}`)
    .then((r) => r.json())
    .then((res) => {
      if (res.data) {
        const traded = res.data.is_traded === 1
        isTraded.value = traded
        // 确认是 ETF/LOF 时才加载行情数据并默认切换到 1周
        if (traded) {
          fundStore.loadMarketHistory(fundCode.value)
          selectedRange.value = '1w'
        }
      }
    })
    .catch(() => {})

  // 3) 加载净值历史
  fundStore.loadNavHistory(fundCode.value)
})
</script>

<template>
  <div class="detail-page">
    <!-- 顶部导航 -->
    <header class="detail-header">
      <button class="back-btn" @click="goBack">← 返回</button>
      <h2 class="detail-title">基金详情</h2>
      <div class="header-spacer"></div>
    </header>

    <!-- 基金概览（复用 FundCard） -->
    <div class="overview-section">
      <FundCard
        v-if="currentFund"
        :fund-code="currentFund.info.fund_code"
        :fund-name="currentFund.info.fund_name"
        :unit-nav="currentFund.latestNav?.unit_nav ?? null"
        :daily-growth-rate="currentFund.latestNav?.daily_growth_rate ?? null"
        :nav-date="currentFund.latestNav?.nav_date ?? null"
        :show-footer="true"
      />
      <div v-else class="overview-empty">
        未找到基金信息
      </div>
    </div>

    <!-- 累计净值信息行 -->
    <div v-if="currentFund?.latestNav" class="extra-info">
      <div class="info-item">
        <span class="info-label">基金类型</span>
        <span class="info-value">{{ currentFund.info.fund_type ?? '--' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">累计净值</span>
        <span class="info-value">
          {{ currentFund.latestNav.accum_nav?.toFixed(4) ?? '--' }}
        </span>
      </div>
    </div>

    <!-- 净值走势 / K线图（仅ETF/LOF在短周期显示K线） -->
    <div class="chart-section">
      <h3 class="section-title">{{ showCandle ? '日K走势' : '净值走势' }}</h3>

      <!-- 时间范围选择 -->
      <div class="range-tabs">
        <button
          v-for="opt in rangeOptions"
          :key="opt.key"
          class="range-btn"
          :class="{ active: selectedRange === opt.key }"
          @click="selectRange(opt.key)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 图表 -->
      <FundNavChart
        :data="chartPoints"
        :loading="chartLoading"
        mode="absolute"
        :chart-type="showCandle ? 'candle' : 'line'"
        :market-data="showCandle ? marketPoints : undefined"
      />
    </div>

    <!-- 累计收益率（始终显示百分比折线图） -->
    <div class="chart-section" style="margin-top: 12px;">
      <h3 class="section-title">累计收益率</h3>

      <FundNavChart
        :data="chartPoints"
        :loading="chartLoading"
        mode="percentage"
      />
    </div>

    <!-- 底部安全区域 -->
    <div class="bottom-safe"></div>
  </div>
</template>

<style scoped>
.detail-page {
  padding: 0 var(--spacing-lg, 16px) var(--spacing-xl, 20px);
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: var(--color-bg, #f5f5f5);
  box-sizing: border-box;
}

/* ── 顶部导航 ── */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  position: sticky;
  top: 0;
  background: var(--color-bg, #f5f5f5);
  z-index: 10;
}

.back-btn {
  background: none;
  border: none;
  font-size: var(--font-md, 15px);
  color: var(--color-primary, #1890ff);
  cursor: pointer;
  padding: 12px 4px; /* 增大热区 */
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.back-btn:active {
  opacity: 0.6;
}

.detail-title {
  font-size: var(--font-lg, 17px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
}

.header-spacer {
  width: 48px;
  flex-shrink: 0;
}

/* ── 概览 ── */
.overview-section {
  margin-bottom: var(--spacing-md, 12px);
}

.overview-empty {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 40px var(--spacing-lg, 16px);
  text-align: center;
  color: var(--color-text-tertiary, #999);
  font-size: var(--font-base, 14px);
}

/* ── 额外信息行 ── */
.extra-info {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 12px var(--spacing-lg, 16px);
  margin-bottom: var(--spacing-md, 12px);
  display: flex;
  gap: 24px;
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: var(--font-sm, 11px);
  color: var(--color-text-tertiary, #999);
}

.info-value {
  font-size: var(--font-base, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #1a1a1a);
}

/* ── 图表区域 ── */
.chart-section {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
}

.chart-section:nth-of-type(1) {
  animation-delay: 0.05s;
}
.chart-section:nth-of-type(2) {
  animation-delay: 0.1s;
}

.section-title {
  font-size: var(--font-md, 15px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0 0 12px 0;
}

/* ── 时间范围选择 ── */
.range-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.range-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--color-border, #e8e8e8);
  border-radius: var(--radius-sm, 6px);
  background: #fafafa;
  font-size: var(--font-xs, 12px);
  color: var(--color-text-secondary, #666);
  cursor: pointer;
  transition: all var(--duration-normal, 0.2s) var(--ease-out, ease);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.range-btn.active {
  background: var(--color-primary, #1890ff);
  color: var(--color-white, #fff);
  border-color: var(--color-primary, #1890ff);
}

.range-btn:active {
  opacity: 0.8;
  transform: scale(0.97);
}

/* ── 底部安全区域 ── */
.bottom-safe {
  height: calc(20px + var(--safe-area-bottom, 0px));
}
</style>
