<script setup lang="ts">
import { ref, onMounted } from 'vue'

// ── 新闻数据模型 ──
interface NewsItem {
  id: number
  title: string
  summary: string
  source: string
  date: string
  tag: string
  tagColor: string
}

// ── 模拟新闻数据 ──
const mockNews: NewsItem[] = [
  {
    id: 1,
    title: '央行宣布降准0.5个百分点 释放长期资金约1万亿元',
    summary: '中国人民银行决定自2026年6月15日起下调金融机构存款准备金率0.5个百分点，此次降准预计将释放长期资金约1万亿元，旨在支持实体经济发展，降低社会融资成本。',
    source: '中国人民银行',
    date: '2026-06-30',
    tag: '政策',
    tagColor: '#e84e1b',
  },
  {
    id: 2,
    title: 'A股三大指数集体收涨 医药板块表现强势',
    summary: '今日A股三大指数集体收涨，沪指涨0.85%报3150点，深成指涨1.25%，创业板指涨1.58%。医药生物板块全天表现强势，多只个股涨停。',
    source: '证券时报',
    date: '2026-06-29',
    tag: '市场',
    tagColor: '#1890ff',
  },
  {
    id: 3,
    title: '公募基金规模突破30万亿元 创新高',
    summary: '截至2026年5月底，我国公募基金总规模首次突破30万亿元大关，较年初增长约12%。其中权益类基金规模增长显著，反映出投资者对资本市场的信心持续增强。',
    source: '中国基金报',
    date: '2026-06-27',
    tag: '基金',
    tagColor: '#52c41a',
  },
  {
    id: 4,
    title: 'ETF互联互通扩容 新增纳入多只科创50ETF',
    summary: '交易所发布通知，ETF互联互通标的将进行扩容，新增纳入多只科创50ETF及创业板ETF，进一步丰富两地投资者的资产配置选择，推动资本市场双向开放。',
    source: '上交所',
    date: '2026-06-25',
    tag: '市场',
    tagColor: '#1890ff',
  },
  {
    id: 5,
    title: '新能源板块迎政策利好 光伏产业链持续景气',
    summary: '国家能源局发布最新政策，明确将加大对新能源项目的支持力度，推动光伏、风电等清洁能源高质量发展。受此消息提振，新能源板块整体走强。',
    source: '经济日报',
    date: '2026-06-23',
    tag: '政策',
    tagColor: '#e84e1b',
  },
  {
    id: 6,
    title: 'FOF基金二季度调仓动向：增配科技与红利策略',
    summary: '随着二季度临近尾声，多只FOF基金披露最新持仓调整情况，整体呈现增配科技成长板块和红利策略的趋势，均衡配置成为主流思路。',
    source: '中国基金报',
    date: '2026-06-21',
    tag: '基金',
    tagColor: '#52c41a',
  },
]

// ── 状态 ──
const newsList = ref<NewsItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const refreshKey = ref(0)

// ── 模拟网络加载 ──
async function loadNews() {
  loading.value = true
  error.value = null
  try {
    // 模拟异步请求延迟
    await new Promise((resolve) => setTimeout(resolve, 800))
    newsList.value = mockNews
  } catch {
    error.value = '加载新闻失败，请重试'
  } finally {
    loading.value = false
  }
}

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
  const duration = 150

  if (initial === 0) return

  function step(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
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
    loadNews().finally(() => {
      refreshing.value = false
      pullDistance.value = 0
      refreshKey.value++
    })
  } else if (pullDistance.value > 0) {
    smoothReset()
  }
  isPulling.value = false
}

onMounted(() => {
  loadNews()
})
</script>

<template>
  <div
    class="news-page"
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

    <!-- 页面头部（固定，Teleport 到 body） -->
    <Teleport to="body">
      <header class="page-header">
        <h1 class="page-title">新闻资讯</h1>
      </header>
    </Teleport>

    <!-- 加载中（首次） -->
    <Transition name="fade">
      <div v-if="loading && newsList.length === 0" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <div v-if="error && newsList.length === 0" class="error-state">
      {{ error }}
      <button class="retry-btn" @click="loadNews()">重试</button>
    </div>

    <!-- 新闻列表（TransitionGroup） -->
    <TransitionGroup v-if="!loading && !error && newsList.length > 0" name="list" tag="div" class="news-list" :key="refreshKey">
      <article
        v-for="(item, index) in newsList"
        :key="item.id"
        class="news-card"
        :style="{ '--index': index }"
      >
        <div class="news-card-header">
          <span class="news-tag" :style="{ background: item.tagColor + '1a', color: item.tagColor }">
            {{ item.tag }}
          </span>
          <span class="news-date">{{ item.date }}</span>
        </div>
        <h3 class="news-title">{{ item.title }}</h3>
        <p class="news-summary">{{ item.summary }}</p>
        <div class="news-card-footer">
          <span class="news-source">{{ item.source }}</span>
        </div>
      </article>
    </TransitionGroup>

    <!-- 空状态（数据加载完毕但无新闻） -->
    <div v-else-if="!loading && !error && newsList.length === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <span>暂无新闻</span>
    </div>
  </div>
</template>

<style scoped>
.news-page {
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

/* ── 空状态 ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--color-text-tertiary, #999);
  gap: 12px;
  font-size: var(--font-base, 14px);
}

.empty-icon {
  font-size: 36px;
}

/* ── 新闻列表（TransitionGroup） ── */
.news-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

/* 入场动画：交错 fadeInUp */
.news-card {
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

/* ── 新闻卡片 ── */
.news-card {
  background: var(--color-white, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  cursor: pointer;
  transition: box-shadow var(--duration-normal, 0.2s) var(--ease-out, ease);
  -webkit-tap-highlight-color: transparent;
}

.news-card:active {
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.1));
}

.news-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm, 8px);
}

.news-tag {
  font-size: var(--font-xs, 11px);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
  line-height: 1.5;
}

.news-date {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-muted, #bbb);
  flex-shrink: 0;
}

.news-title {
  font-size: var(--font-md, 15px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-summary {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-secondary, #666);
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.news-source {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-tertiary, #999);
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