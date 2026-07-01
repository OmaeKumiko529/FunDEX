import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { FundInfo, FundNav, FundMarket, FundDisplay, SearchResult } from '@/types/fund'

export const useFundStore = defineStore('fund', () => {
  // ── 状态 ──
  const fundInfos = ref<FundInfo[]>([])
  const latestNavs = ref<Record<string, FundNav | null>>({})
  const navHistory = ref<Record<string, FundNav[]>>({})
  const marketHistory = ref<Record<string, FundMarket[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── 本地持久化：置顶 / 移除 ──
  const pinnedCodes = ref<string[]>(loadPinnedCodes())
  const removedCodes = ref<string[]>(loadRemovedCodes())

  function loadPinnedCodes(): string[] {
    try { return JSON.parse(localStorage.getItem('pinned_codes') || '[]') }
    catch { return [] }
  }
  function savePinnedCodes() {
    localStorage.setItem('pinned_codes', JSON.stringify(pinnedCodes.value))
  }

  function loadRemovedCodes(): string[] {
    try { return JSON.parse(localStorage.getItem('removed_codes') || '[]') }
    catch { return [] }
  }
  function saveRemovedCodes() {
    localStorage.setItem('removed_codes', JSON.stringify(removedCodes.value))
  }

  // ── 计算：合并为 FundDisplay 列表（过滤已移除、置顶排序） ──
  const funds = computed<FundDisplay[]>(() => {
    return fundInfos.value
      .filter(info => !removedCodes.value.includes(info.fund_code))
      .map(info => ({
        info,
        latestNav: latestNavs.value[info.fund_code] ?? null,
      }))
      .sort((a, b) => {
        const aPin = pinnedCodes.value.includes(a.info.fund_code) ? 1 : 0
        const bPin = pinnedCodes.value.includes(b.info.fund_code) ? 1 : 0
        return bPin - aPin
      })
  })

  // ── API 基础地址 ──
  // 使用相对路径，由 Vite Dev Server 的 proxy 转发到后端
  // 本机、WiFi ADB、虚拟机三种场景都可用，无需修改配置
  const API_BASE = ''

  // ── 动作：加载行情列表 ──
  async function loadFunds() {
    loading.value = true
    error.value = null

    try {
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
      return
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
      return
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

  // ── 动作：搜索基金 ──
  async function searchFunds(keyword: string): Promise<SearchResult[]> {
    if (!keyword.trim()) return []
    try {
      const res = await fetch(`${API_BASE}/api/fund-info/search?keyword=${encodeURIComponent(keyword.trim())}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.data as SearchResult[]
    } catch (e) {
      console.error('搜索基金失败:', e)
      return []
    }
  }

  // ── 动作：检查单只基金是否存在 ──
  async function checkFundExists(fundCode: string): Promise<FundInfo | null> {
    try {
      const res = await fetch(`${API_BASE}/api/fund-info/${fundCode}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.data as FundInfo
    } catch {
      return null
    }
  }

  // ── 动作：获取单只基金最新净值 ──
  async function getFundLatestNav(fundCode: string): Promise<FundNav | null> {
    try {
      const res = await fetch(`${API_BASE}/api/fund-nav/${fundCode}/latest`)
      if (!res.ok) return null
      const data = await res.json()
      return data.data as FundNav
    } catch {
      return null
    }
  }

  // ── 动作：触发爬虫拉取 ──
  async function fetchFundByCrawler(fundCode: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/fund-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fund_code: fundCode }),
      })
      return res.ok
    } catch (e) {
      console.error('触发爬虫失败:', e)
      return false
    }
  }

  // ── 动作：置顶 / 取消置顶 ──
  function togglePin(fundCode: string) {
    const idx = pinnedCodes.value.indexOf(fundCode)
    if (idx >= 0) {
      pinnedCodes.value.splice(idx, 1)
    } else {
      pinnedCodes.value.push(fundCode)
    }
    savePinnedCodes()
  }

  function isPinned(fundCode: string): boolean {
    return pinnedCodes.value.includes(fundCode)
  }

  // ── 动作：从自选列表移除 ──
  function removeFund(fundCode: string) {
    if (!removedCodes.value.includes(fundCode)) {
      removedCodes.value.push(fundCode)
      saveRemovedCodes()
    }
  }

  function isRemoved(fundCode: string): boolean {
    return removedCodes.value.includes(fundCode)
  }

  return {
    funds, navHistory, marketHistory, loading, error,
    loadFunds, loadNavHistory, loadMarketHistory,
    searchFunds, checkFundExists, getFundLatestNav, fetchFundByCrawler,
    togglePin, isPinned, removeFund, isRemoved,
  }
})