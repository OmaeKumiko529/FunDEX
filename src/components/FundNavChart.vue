<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial'
import type { ChartOptions } from 'chart.js'
import type { FundMarket } from '@/types/fund'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  CandlestickController,
  CandlestickElement,
  Title,
  Tooltip,
  Filler,
)

export interface ChartPoint {
  nav_date: string
  unit_nav: number
  accum_nav: number | null
}

const props = defineProps<{
  data: ChartPoint[]
  loading?: boolean
  /** 显示模式: absolute=净值绝对值, percentage=相对基准百分比 */
  mode?: 'absolute' | 'percentage'
  /** 图表类型: line=净值折线(默认), candle=K线行情(仅ETF/LOF) */
  chartType?: 'line' | 'candle'
  /** K线行情数据（chartType='candle' 时必传） */
  marketData?: FundMarket[]
}>()

// ── K线选中状态（移动端友好：点击蜡烛固定显示，再点空白取消） ──
const selectedCandleIndex = ref<number | null>(null)
const currentCandle = computed<FundMarket | null>(() => {
  const arr = sortedMarket.value
  if (!arr.length) return null
  if (selectedCandleIndex.value !== null) {
    return arr[selectedCandleIndex.value] ?? null
  }
  // 未选中时显示最后一根
  return arr[arr.length - 1] ?? null
})

// ── 排序：确保数据从左到右从早到晚（后端可能返回 DESC） ──
const sortedData = computed<ChartPoint[]>(() => {
  return [...props.data].sort(
    (a, b) => a.nav_date.localeCompare(b.nav_date)
  )
})

// ── K线数据排序 ──
const sortedMarket = computed<FundMarket[]>(() => {
  if (!props.marketData) return []
  return [...props.marketData].sort(
    (a, b) => a.trade_date.localeCompare(b.trade_date)
  )
})

// ── 百分比模式下：以 sortedData[0].unit_nav 为 0% 基准 ──
const pctData = computed<number[]>(() => {
  if (sortedData.value.length === 0) return []
  const base = sortedData.value[0].unit_nav
  if (base === 0) return sortedData.value.map(() => 0)
  return sortedData.value.map((p) => ((p.unit_nav - base) / base) * 100)
})

// ── Y 轴数据值（根据 mode 选择） ──
const yData = computed<number[]>(() => {
  if (props.mode === 'percentage') return pctData.value
  return sortedData.value.map((p) => p.unit_nav)
})

// ── 图表标签 ──
const chartLabel = computed(() => props.mode === 'percentage' ? '累计收益率' : '单位净值')

// ── Y 轴格式化 ──
const yTickFormat = computed(() => {
  if (props.mode === 'percentage') {
    return (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }
  return (value: number) => value.toFixed(4)
})

// ── Tooltip 格式化 ──
const tooltipLabel = computed(() => {
  if (props.mode === 'percentage') {
    return (item: any) => `${item.dataset.label}: ${item.raw >= 0 ? '+' : ''}${Number(item.raw).toFixed(2)}%`
  }
  return (item: any) => `${item.dataset.label}: ${Number(item.raw).toFixed(4)}`
})

// ── 图表数据 ──
const chartData = computed<any>(() => {
  if (props.chartType === 'candle') {
    return buildCandleData()
  }
  return buildLineData()
})

function buildLineData() {
  const labels = sortedData.value.map((p) => p.nav_date)

  return {
    labels,
    datasets: [
      {
        label: chartLabel.value,
        data: yData.value,
        segment: {
          borderColor: (ctx: any) => {
            const prev = ctx.p0.parsed.y
            const curr = ctx.p1.parsed.y
            return curr >= prev ? '#e74c3c' : '#27ae60'
          },
        },
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHitRadius: 10,
        borderWidth: 2,
      },
      ...(props.mode !== 'percentage' && sortedData.value.some((p) => p.accum_nav !== null)
        ? [
            {
              label: '累计净值',
              data: sortedData.value.map((p) => p.accum_nav),
              borderColor: '#999999',
              backgroundColor: 'transparent',
              borderDash: [5, 3],
              fill: false,
              tension: 0,
              pointRadius: 0,
              pointHitRadius: 5,
              borderWidth: 1.5,
            },
          ]
        : []),
    ],
  }
}

function buildCandleData() {
  const labels = sortedMarket.value.map((p) => p.trade_date)
  const volumeData = sortedMarket.value.map((p) => {
    const amount = p.amount ?? 0
    return amount / 100000000
  })

  return {
    labels,
    datasets: [
      {
        label: 'K线',
        type: 'candlestick' as const,
        data: sortedMarket.value.map((p) => ({
          x: new Date(p.trade_date).getTime(),
          o: p.open,
          h: p.high,
          l: p.low,
          c: p.close,
        })),
        color: {
          up: '#e74c3c' as const,
          down: '#27ae60' as const,
          unchanged: '#999999' as const,
        },
        order: 1,
      },
      {
        label: '成交量(亿)',
        type: 'bar' as const,
        data: volumeData,
        yAxisID: 'y1',
        backgroundColor: volumeData.map((_, idx) => {
          const prev = idx > 0 ? sortedMarket.value[idx - 1] : null
          const curr = sortedMarket.value[idx]
          if (prev && curr.close >= prev.close) {
            return 'rgba(231, 76, 60, 0.3)'
          }
          return 'rgba(39, 174, 96, 0.3)'
        }),
        borderColor: 'transparent',
        borderWidth: 0,
        order: 2,
        barPercentage: 0.8,
        categoryPercentage: 0.7,
      },
    ],
  }
}

// ── 图表配置 ──
const chartOptions = computed<any>(() => {
  if (props.chartType === 'candle') {
    return buildCandleOptions()
  }
  return buildLineOptions()
})

function buildLineOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: props.mode !== 'percentage' && sortedData.value.some((p) => p.accum_nav !== null),
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 12,
          font: { size: 11 },
          color: '#666',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        padding: 8,
        bodyFont: { size: 12 },
        callbacks: {
          title: (items: any) => items[0].label,
          label: tooltipLabel.value,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#999',
          callback: (value: any) => {
            const idx = Number(value)
            const label = chartData.value.labels[idx]
            if (!label) return ''
            const d = label.split('-')
            return `${d[0]}/${d[1]}/${d[2]}`
          },
        },
        afterBuildTicks: (axis: any) => {
          axis.ticks = [
            { value: 0 },
            { value: sortedData.value.length - 1 },
          ]
        },
      },
      y: {
        grid: {
          color: 'rgba(0,0,0,0.04)',
        },
        ticks: {
          font: { size: 10 },
          color: '#999',
          callback: (value: any) => yTickFormat.value(Number(value)),
        },
      },
    },
  }
}

function buildCandleOptions(): any {
  let priceMin = 0
  let priceMax = 0
  if (sortedMarket.value.length > 0) {
    const high = sortedMarket.value.map((p) => p.high)
    const low = sortedMarket.value.map((p) => p.low)
    priceMin = Math.min(...low)
    priceMax = Math.max(...high)
  }
  const padding = (priceMax - priceMin) * 0.05 || priceMax * 0.1 || 0.1

  return {
    responsive: true,
    maintainAspectRatio: false,
    // 点击事件委托给 chart 实例处理
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const el = elements[0]
        // elements[0].index 是 dataset index，elements[0].datasetIndex 是 dataset 编号
        // candlestick 是第一层 dataset（K线）
        const firstCandleDataset = 0
        if (el.datasetIndex === firstCandleDataset) {
          if (selectedCandleIndex.value === el.index) {
            selectedCandleIndex.value = null // 再次点击取消
          } else {
            selectedCandleIndex.value = el.index
          }
        }
      } else {
        // 点击空白取消选中
        selectedCandleIndex.value = null
      }
    },
    interaction: {
      intersect: true,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 12,
          font: { size: 11 },
          color: '#666',
        },
      },
      // K线模式下禁用浮动 tooltip，使用下方固定信息条
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#999',
          maxTicksLimit: 8,
          callback: (value: any) => {
            const idx = Number(value)
            const label = chartData.value.labels[idx]
            if (!label) return ''
            const d = label.split('-')
            return `${d[0]}/${d[1]}/${d[2]}`
          },
        },
      },
      y: {
        position: 'left',
        min: priceMin - padding,
        max: priceMax + padding,
        grid: {
          color: 'rgba(0,0,0,0.04)',
        },
        ticks: {
          font: { size: 10 },
          color: '#999',
        },
      },
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#999',
          callback: (value: any) => Number(value).toFixed(1) + '亿',
        },
      },
    },
  }
}

// ── 格式化日期 ──
function formatDate(dateStr: string): string {
  const d = dateStr.split('-')
  return `${d[1]}/${d[2]}`
}

// ── 响应式 ──
const chartRef = ref<InstanceType<typeof Line> | null>(null)
const chartHeight = ref(220)

function updateChartHeight() {
  const vw = window.innerWidth
  chartHeight.value = vw < 480 ? 200 : 260
}

onMounted(() => {
  updateChartHeight()
  window.addEventListener('resize', updateChartHeight)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateChartHeight)
})
</script>

<template>
  <div class="chart-wrapper">
    <div v-if="loading" class="chart-placeholder">
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
    <div v-else-if="chartType === 'candle' && (!marketData || marketData.length === 0)" class="chart-placeholder">
      <span class="no-data">暂无K线数据</span>
    </div>
    <div v-else-if="data.length === 0 && chartType !== 'candle'" class="chart-placeholder">
      <span class="no-data">暂无净值数据</span>
    </div>
    <div v-else class="chart-container" :style="{ height: chartHeight + 'px' }">
      <Line ref="chartRef" :data="chartData" :options="chartOptions" />
    </div>

    <!-- ── K线信息条（移动端友好，固定在图表下方） ── -->
    <Transition name="candle-info">
      <div v-if="chartType === 'candle' && currentCandle" class="candle-info-bar" :key="currentCandle.trade_date">
        <!-- 日期 -->
        <div class="candle-info-item date-item">
          <span class="candle-info-label">日期</span>
          <span class="candle-info-value">{{ currentCandle.trade_date }}</span>
        </div>
        <div class="candle-info-divider"></div>
        <!-- OHLC -->
        <div class="candle-info-item">
          <span class="candle-info-label">开</span>
          <span class="candle-info-value" :class="currentCandle.close >= currentCandle.open ? 'up' : 'down'">
            {{ currentCandle.open.toFixed(4) }}
          </span>
        </div>
        <div class="candle-info-item">
          <span class="candle-info-label">高</span>
          <span class="candle-info-value">{{ currentCandle.high.toFixed(4) }}</span>
        </div>
        <div class="candle-info-item">
          <span class="candle-info-label">低</span>
          <span class="candle-info-value">{{ currentCandle.low.toFixed(4) }}</span>
        </div>
        <div class="candle-info-item">
          <span class="candle-info-label">收</span>
          <span class="candle-info-value" :class="currentCandle.close >= currentCandle.open ? 'up' : 'down'">
            {{ currentCandle.close.toFixed(4) }}
          </span>
        </div>
        <div class="candle-info-divider"></div>
        <!-- 成交额 -->
        <div class="candle-info-item">
          <span class="candle-info-label">成交</span>
          <span class="candle-info-value">
            {{ (currentCandle.amount ?? 0) > 0 ? (currentCandle.amount! / 100000000).toFixed(2) + '亿' : '--' }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chart-wrapper {
  width: 100%;
}
.chart-container {
  width: 100%;
  transition: height 0.3s ease;
}
/* ── 骨架屏 / 空态 ── */
.chart-placeholder {
  width: 100%;
  height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  background: #fafafa;
  border-radius: 8px;
}
.skeleton-line {
  width: 80%;
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-line.short {
  width: 50%;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.no-data {
  color: #bbb;
  font-size: 14px;
}

/* ── K线信息条（图表下方固定显示） ── */
.candle-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9fafb;
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 8px;
  gap: 4px;
}
.candle-info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 0;
  flex-shrink: 1;
}
.candle-info-item.date-item {
  min-width: 56px;
}
.candle-info-label {
  font-size: 9px;
  color: #999;
  line-height: 1.2;
}
.candle-info-value {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.candle-info-value.up {
  color: #e74c3c;
}
.candle-info-value.down {
  color: #27ae60;
}
.candle-info-divider {
  width: 1px;
  height: 28px;
  background: #e8e8e8;
  flex-shrink: 0;
}

/* ── K线信息条入场/切换过渡 ── */
.candle-info-enter-active {
  animation: candleInfoIn var(--duration-normal, 0.2s) var(--ease-out, ease);
}
.candle-info-leave-active {
  animation: candleInfoOut var(--duration-fast, 0.15s) var(--ease-out, ease);
}

@keyframes candleInfoIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes candleInfoOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

/* ── 图表容器入场动画 ── */
.chart-container {
  animation: fadeIn var(--duration-slow, 0.3s) var(--ease-out, ease) both;
}
</style>
