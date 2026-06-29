<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  fundCode: string
  fundName: string
  unitNav: number | null
  dailyGrowthRate: number | null
  navDate: string | null
  /** 是否显示日期底部栏，详情页可隐藏 */
  showFooter?: boolean
}>()

// 格式化日增长率：小数转百分比字符串
function formatGrowthRate(value: number | null): string {
  if (value === null || value === undefined) return '--'
  const pct = (value * 100).toFixed(2)
  return pct.startsWith('-') ? `${pct}%` : `+${pct}%`
}

// 根据日增长率返回 CSS 类名（正数红色，负数绿色，零灰色）
function growthClass(value: number | null): string {
  if (value === null || value === undefined) return 'neutral'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

// 格式化单位净值
function formatNav(value: number | null): string {
  if (value === null || value === undefined) return '--'
  return value.toFixed(4)
}

const growthFormatted = computed(() => formatGrowthRate(props.dailyGrowthRate))
const growthCss = computed(() => growthClass(props.dailyGrowthRate))
const navFormatted = computed(() => formatNav(props.unitNav))
</script>

<template>
  <div class="fund-card">
    <!-- 基本信息行 -->
    <div class="card-header">
      <div class="fund-name">{{ fundName }}</div>
      <div class="fund-code">{{ fundCode }}</div>
    </div>

    <!-- 净值数据行 -->
    <div class="card-body">
      <div class="nav-section">
        <div class="nav-value">{{ navFormatted }}</div>
        <div class="nav-label">单位净值</div>
      </div>
      <div class="growth-section">
        <div class="growth-value" :class="growthCss">
          {{ growthFormatted }}
        </div>
        <div class="growth-label">日增长率</div>
      </div>
    </div>

    <!-- 数据日期 -->
    <div v-if="showFooter !== false" class="card-footer">
      数据日期: {{ navDate ?? '--' }}
    </div>
  </div>
</template>

<style scoped>
.fund-card {
  background: var(--color-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
  transition: box-shadow var(--duration-normal, 0.2s) var(--ease-out, ease),
              transform var(--duration-fast, 0.15s) var(--ease-out, ease);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.fund-card:active {
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.1));
  transform: scale(0.985);
}

/* ── 卡片头部：名称 + 代码 ── */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.fund-name {
  font-size: var(--font-lg, 16px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-code {
  font-size: var(--font-xs, 12px);
  color: var(--color-text-tertiary, #999);
  margin-left: var(--spacing-sm, 8px);
  flex-shrink: 0;
}

/* ── 卡片主体：净值 + 日增长率 ── */
.card-body {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 10px;
}

.nav-section {
  flex: 1;
}

.nav-value {
  font-size: var(--font-nav-value, 28px);
  font-weight: 700;
  color: var(--color-text-primary, #1a1a1a);
  line-height: 1.1;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.nav-label {
  font-size: var(--font-sm, 11px);
  color: var(--color-text-tertiary, #999);
}

.growth-section {
  text-align: right;
  flex-shrink: 0;
}

.growth-value {
  font-size: var(--font-2xl, 20px);
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.growth-value.up {
  color: var(--color-up, #e74c3c);
}

.growth-value.down {
  color: var(--color-down, #27ae60);
}

.growth-value.neutral {
  color: var(--color-text-tertiary, #999);
}

.growth-label {
  font-size: var(--font-sm, 11px);
  color: var(--color-text-tertiary, #999);
}

/* ── 卡片底部：日期 ── */
.card-footer {
  font-size: var(--font-sm, 11px);
  color: var(--color-text-muted, #bbb);
  border-top: 1px solid var(--color-border-light, #f0f0f0);
  padding-top: 10px;
}

/* ── 入场动画 ── */
.fund-card {
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
}
</style>
