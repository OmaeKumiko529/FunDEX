<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LongPressPayload } from '@/types/fund'

const props = defineProps<{
  fundCode: string
  fundName: string
  unitNav: number | null
  dailyGrowthRate: number | null
  navDate: string | null
  /** 是否显示日期底部栏，详情页可隐藏 */
  showFooter?: boolean
  /** 是否置顶 */
  pinned?: boolean
}>()

const emit = defineEmits<{
  click: [fundCode: string]
  longpress: [payload: LongPressPayload]
}>()

// ── 长按识别 ──
const LONG_PRESS_MS = 600
const MOVE_THRESHOLD = 10
let pressTimer: ReturnType<typeof setTimeout> | null = null
let isLongPress = false
let pressStartX = 0
let pressStartY = 0
const pressed = ref(false)

function onTouchStart(e: TouchEvent) {
  isLongPress = false
  const touch = e.touches?.[0]
  if (!touch) return
  pressStartX = touch.clientX
  pressStartY = touch.clientY
  pressed.value = true
  pressTimer = setTimeout(() => {
    isLongPress = true
    // 震动反馈（仅支持设备）
    if (navigator.vibrate) navigator.vibrate(15)
    emit('longpress', {
      fundCode: props.fundCode,
      fundName: props.fundName,
      x: touch.clientX,
      y: touch.clientY,
    })
  }, LONG_PRESS_MS)
}

function onTouchMove(e: TouchEvent) {
  if (!pressTimer) return
  const touch = e.touches?.[0]
  if (!touch) return
  const dx = Math.abs(touch.clientX - pressStartX)
  const dy = Math.abs(touch.clientY - pressStartY)
  if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onTouchEnd() {
  pressed.value = false
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  // 如果已经触发了长按，阻止 click 事件
  if (isLongPress) return
  emit('click', props.fundCode)
}

// ── 格式化函数 ──
function formatGrowthRate(value: number | null): string {
  if (value === null || value === undefined) return '--'
  const pct = (value * 100).toFixed(2)
  return pct.startsWith('-') ? `${pct}%` : `+${pct}%`
}

function growthClass(value: number | null): string {
  if (value === null || value === undefined) return 'neutral'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

function formatNav(value: number | null): string {
  if (value === null || value === undefined) return '--'
  return value.toFixed(4)
}

const growthFormatted = computed(() => formatGrowthRate(props.dailyGrowthRate))
const growthCss = computed(() => growthClass(props.dailyGrowthRate))
const navFormatted = computed(() => formatNav(props.unitNav))
</script>

<template>
  <div
    class="fund-card"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- 长按被触发时的视觉反馈 -->
    <div v-if="pressed" class="longpress-feedback"></div>

    <!-- 置顶标识 -->
    <div v-if="pinned" class="pinned-badge">📌</div>

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
  position: relative;
  background: var(--color-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 4px rgba(0, 0, 0, 0.06));
  transition: box-shadow var(--duration-normal, 0.2s) var(--ease-out, ease),
              transform var(--duration-fast, 0.15s) var(--ease-out, ease);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.fund-card:active {
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.1));
  transform: scale(0.985);
}

/* ── 置顶标识 ── */
.pinned-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  background: var(--color-primary, #1890ff);
  border-radius: var(--radius-full, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.3);
  z-index: 2;
  animation: fadeInUp var(--duration-slow, 0.3s) var(--ease-out, ease) both;
  pointer-events: none;
}

/* ── 长按反馈 ── */
.longpress-feedback {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg, 12px);
  background: var(--color-primary, #1890ff);
  opacity: 0.08;
  pointer-events: none;
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