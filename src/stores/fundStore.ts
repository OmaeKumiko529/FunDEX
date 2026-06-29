import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { FundInfo, FundNav, FundMarket, FundDisplay } from '@/types/fund'

export const useFundStore = defineStore('fund', () => {
  // ── 状态 ──
  const fundInfos = ref<FundInfo[]>([])
  const latestNavs = ref<Record<string, FundNav | null>>({})
  const navHistory = ref<Record<string, FundNav[]>>({})
  const marketHistory = ref<Record<string, FundMarket[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── 计算：合并为 FundDisplay 列表 ──
  const funds = computed<FundDisplay[]>(() => {
    return fundInfos.value.map((info) => ({
      info,
      latestNav: latestNavs.value[info.fund_code] ?? null,
    }))
  })

  // ── API 基础地址（通过环境变量配置，默认 fallback） ──
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

  // ── 动作：加载行情列表 ──
  async function loadFunds() {
    loading.value = true
    error.value = null

    try {
      // 获取所有基金信息
      const infoRes = await fetch(`${API_BASE}/api/fund-info`)
      if (!infoRes.ok) throw new Error(`HTTP ${infoRes.status}`)
      const infoData = await infoRes.json()
      fundInfos.value = infoData.data

      // 获取每只基金的最新净值
      const navMap: Record<string, FundNav | null> = {}
      for (const info of fundInfos.value) {
        try {
          const navRes = await fetch(`${API_BASE}/api/fund-nav/${info.fund_code}/latest`)
          if (navRes.ok) {
            const navData = await navRes.json()
            navMap[info.fund_code] = navData.data ?? null
          }
        } catch {
          // 单只基金净值获取失败不影响其他基金
          navMap[info.fund_code] = null
        }
      }
      latestNavs.value = navMap
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载基金数据失败'
      fundInfos.value = []
    } finally {
      loading.value = false
    }
  }

  // ── 动作：加载某基金的全部历史净值（带缓存） ──
  async function loadNavHistory(fundCode: string) {
    if (navHistory.value[fundCode] && navHistory.value[fundCode].length > 0) {
      return // 已缓存，不需要重复请求
    }

    loading.value = true
    try {
      const res = await fetch(`${API_BASE}/api/fund-nav/${fundCode}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      navHistory.value[fundCode] = data.data
    } catch (e) {
      console.error(`加载 ${fundCode} 历史净值失败:`, e)
      navHistory.value[fundCode] = []
    } finally {
      loading.value = false
    }
  }

  // ── 动作：加载某基金的日K行情数据（带缓存） ──
  async function loadMarketHistory(fundCode: string) {
    if (marketHistory.value[fundCode] && marketHistory.value[fundCode].length > 0) {
      return // 已缓存
    }

    loading.value = true
    try {
      const res = await fetch(`${API_BASE}/api/fund-market/${fundCode}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      marketHistory.value[fundCode] = data.data
    } catch (e) {
      console.error(`加载 ${fundCode} 日K行情失败:`, e)
      marketHistory.value[fundCode] = []
    } finally {
      loading.value = false
    }
  }

  return { funds, navHistory, marketHistory, loading, error, loadFunds, loadNavHistory, loadMarketHistory }
})